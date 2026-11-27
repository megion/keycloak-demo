#!/bin/bash
set -euo pipefail

kcadm=/opt/keycloak/bin/kcadm.sh
realm=myapp
"$kcadm" config credentials --server http://keycloak:8080 --realm master \
  --user admin --password admin

# The adapter sends the root callback with a trailing slash. Keep any other
# registered callbacks while fixing realms imported from the old configuration.
frontend_id=$("$kcadm" get clients -r "$realm" -q clientId=myapp-frontend --fields id --format csv --noquotes)
if [[ -z $frontend_id ]]; then
  echo 'Missing required client: myapp-frontend' >&2
  exit 1
fi
redirects=$("$kcadm" get "clients/$frontend_id" -r "$realm" --fields redirectUris --format csv --noquotes)
if [[ ,$redirects, != *,http://localhost:4200/,* ]]; then
  "$kcadm" update "clients/$frontend_id" -r "$realm" -s 'redirectUris+=http://localhost:4200/'
fi

# Startup import skips a realm that already exists. Apply the access-token
# mappers to the shared scope so the SPA and CLI work against that realm too.
scopes=$("$kcadm" get client-scopes -r "$realm" --fields name,id --format csv --noquotes)
scope_id=
while IFS=, read -r name id; do
  if [[ $name == myapp-backend-audience ]]; then
    scope_id=$id
    break
  fi
done <<< "$scopes"
if [[ -z $scope_id ]]; then
  echo 'Missing required client scope: myapp-backend-audience' >&2
  exit 1
fi

mapper_path="client-scopes/$scope_id/protocol-mappers/models"
mapper_names=$("$kcadm" get "$mapper_path" -r "$realm" --fields name --format csv --noquotes)

# Preserve mappers that have already been provisioned on this scope.
ensure_mapper() {
  local name=$1 mapper=$2 config=$3
  if ! grep -Fxq -- "$name" <<< "$mapper_names"; then
    "$kcadm" create "$mapper_path" -r "$realm" -s "name=$name" \
      -s protocol=openid-connect -s "protocolMapper=$mapper" -s "config=$config"
  fi
}

ensure_mapper sub oidc-sub-mapper \
  '{"access.token.claim":"true","introspection.token.claim":"true"}'
ensure_mapper username oidc-usermodel-property-mapper \
  '{"user.attribute":"username","claim.name":"preferred_username","jsonType.label":"String","access.token.claim":"true","id.token.claim":"true","userinfo.token.claim":"true"}'
ensure_mapper email oidc-usermodel-property-mapper \
  '{"user.attribute":"email","claim.name":"email","jsonType.label":"String","access.token.claim":"true","id.token.claim":"true","userinfo.token.claim":"true"}'

"$kcadm" add-roles -r "$realm" --uusername service-account-myapp-backend \
  --cclientid realm-management --rolename view-users
