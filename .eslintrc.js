module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": "standard-with-typescript",
    "ignorePatterns": ["**/migrations/*","node_modules/", "dist/", "build/", ".eslintrc.js"],
    "overrides": [
        {
            "env": {
                "node": true
            },
            "files": [
                ".eslintrc.{js,cjs}"
            ],
            "parserOptions": {
                "sourceType": "script"
            }
        }
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "no-new": "off",
        "no-useless-return": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/indent": ["error", 4],
        "@typescript-eslint/semi": ["error", "always"],
        "@typescript-eslint/strict-boolean-expressions": "off"
    }
}
