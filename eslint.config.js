import globals from "globals"
import jsLint from "@eslint/js"

export default [
  {
    languageOptions: {
        globals: { ...globals.node }
    }
  },
  jsLint.configs.recommended,
]
