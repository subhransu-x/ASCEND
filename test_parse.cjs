const acorn = require('acorn');
const code = 'const x = "<span class=\"oltr\">";';
try {
  acorn.parse(code, {ecmaVersion: 2024, sourceType: 'script'});
  console.log('simple parse ok');
} catch(e) {
  console.error('simple parse failed', e.message);
}
