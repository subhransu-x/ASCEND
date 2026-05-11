
const fs=require("fs");
const acorn=require("acorn");
const js=fs.readFileSync("tmp_longlat_script.js","utf8");
try {
  acorn.parse(js,{ecmaVersion:2024,sourceType:"script"});
  console.log("parsed script OK");
} catch(e) {
  console.error("ERROR",e.message);
  console.error("pos",e.pos,"loc",e.loc);
  const start=Math.max(0,e.pos-40);
  const end=e.pos+40;
  console.error(js.slice(start,end));
}
