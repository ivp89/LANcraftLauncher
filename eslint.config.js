import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import-x";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "import-x": importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-use-before-define": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "react/react-in-jsx-scope": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["default"],
              message: "Import named exports from 'react' instead.",
            },
          ],
        },
      ],
      "import-x/order": [
        "warn",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
          groups: [["builtin", "external"], "internal", "unknown", ["parent", "sibling"], "index"],
          distinctGroup: false,
          pathGroups: [
            { pattern: "react", group: "external", position: "before" },
            { pattern: "@/**", group: "unknown", position: "after" },
          ],
          pathGroupsExcludedImportTypes: ["react"],
        },
      ],
      "import-x/newline-after-import": "warn",
    },
  },
  prettierConfig,
);
