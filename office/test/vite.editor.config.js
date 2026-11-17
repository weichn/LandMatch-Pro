import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[{name:'isolated-editor-db',enforce:'pre',resolveId(source,importer){if(source==='./client'&&importer?.includes('/src/'))return fileURLToPath(new URL('./fakeClient.js',import.meta.url));}},react()],server:{host:'127.0.0.1',port:5177,strictPort:true}});
