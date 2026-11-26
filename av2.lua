vim.api.nvim_create_autocmd("FileType", {
  pattern = "AvanteInput",
  callback = function(ev)
    local opts = { buffer = ev.buf, silent = true }

    -- Например, переключение истории по Alt+p / Alt+n в режиме Insert
    vim.keymap.set("i", "<M-p>", "<C-p>", opts)
    vim.keymap.set("i", "<M-n>", "<C-n>", opts)

    -- Или в режиме Normal (например, клавишами K и J)
    -- vim.keymap.set("n", "K", "i<C-p><Esc>", opts)
    -- vim.keymap.set("n", "J", "i<C-n><Esc>", opts)
  end,
})
