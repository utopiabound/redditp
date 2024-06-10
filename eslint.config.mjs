import globals from "globals";
import pluginJs from "@eslint/js";


export default [
    pluginJs.configs.recommended,
    {
	languageOptions: {
	    sourceType: "commonjs",
	    globals: {
		...globals.browser,
		...globals.jquery,
		log: "readonly",
	    }
	},
    },
];
