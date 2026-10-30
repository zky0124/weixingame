const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),build=path.join(root,'游戏工程/build/web-mobile');
const target=path.resolve(process.argv[2]||path.join(root,'.本地缓存/在线试玩发布'));
const dist=path.join(target,'dist');
if(!fs.existsSync(path.join(build,'index.html')))throw Error('先运行构建首战.ps1，生成Web试玩。');
if(target===root||target.startsWith(path.join(root,'游戏工程')+path.sep))throw Error('发布输出不得覆盖项目根目录或游戏工程。');
const allowed=new Set(['.html','.js','.json','.css','.wasm','.png','.jpg','.jpeg','.svg','.bin','.ttf','.woff','.woff2','.ico','.mp3','.ogg']);
const files=[];
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())scan(file);else{const relative=path.relative(build,file);if(!allowed.has(path.extname(file)))throw Error('存在未批准的发布文件类型：'+relative);if(/credential|secret|\.env|\.pem|\.key/i.test(relative))throw Error('发布文件名疑似含凭据：'+relative);files.push(relative);}}}
scan(build);fs.mkdirSync(dist,{recursive:true});
for(const file of files){const out=path.join(dist,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(build,file),out);}
const index=path.join(dist,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace(/<title>.*?<\/title>/,'<title>蛮荒开拓 · 在线试玩</title>'));
const manifest={version:JSON.parse(fs.readFileSync(path.join(root,'游戏工程/package.json'),'utf8')).version,platform:'web-mobile',createdAt:new Date().toISOString(),files:files.map(file=>({path:file.replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,file))).digest('hex')}))};
fs.writeFileSync(path.join(dist,'试玩版本.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({directory:dist,version:manifest.version,files:files.length,scope:'仅游戏Web运行文件，不包含策划、表格、安装器或账号文件'}));
