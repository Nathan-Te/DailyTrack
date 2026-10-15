(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=class{state;constructor(e){this.state=e>>>0}next(){this.state=this.state+1831565813>>>0;let e=this.state;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}int(e){return this.next()%e}chance(e){return this.int(100)<e}pick(e){return e[this.int(e.length)]}shuffle(e){let t=e.slice();for(let e=t.length-1;e>0;e--){let n=this.int(e+1);[t[e],t[n]]=[t[n],t[e]]}return t}};function t(e,t){let n=Math.imul((e|0)^2654435769,2246822507);return n^=n>>>13,n=Math.imul(n^(t|0),3266489909),n^=n>>>16,n>>>0}function n(e,t,n){let r=t<=2?e-1:e,i=Math.floor(r/400),a=r-i*400,o=Math.floor((153*(t+(t>2?-3:9))+2)/5)+n-1,s=a*365+Math.floor(a/4)-Math.floor(a/100)+o;return i*146097+s-719468}function r(e){let t=e+719468,n=Math.floor(t/146097),r=t-n*146097,i=Math.floor((r-Math.floor(r/1460)+Math.floor(r/36524)-Math.floor(r/146096))/365),a=r-(365*i+Math.floor(i/4)-Math.floor(i/100)),o=Math.floor((5*a+2)/153),s=a-Math.floor((153*o+2)/5)+1,c=o+(o<10?3:-9);return{y:i+n*400+ +(c<=2),m:c,d:s}}var i=(e,t)=>{let n=String(e);for(;n.length<t;)n=`0`+n;return n};function a(e){let{y:t,m:n,d:a}=r(e);return`${i(t,4)}-${i(n,2)}-${i(a,2)}`}function o(e){let t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;let r=n(Number(t[1]),Number(t[2]),Number(t[3]));return a(r)===e?r:null}var s=class extends Error{constructor(e){super(e),this.name=`CodecError`}},c=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`;function l(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2];t+=c[r>>2],t+=c[(r&3)<<4|(i??0)>>4],i!==void 0&&(t+=c[(i&15)<<2|(a??0)>>6]),a!==void 0&&(t+=c[a&63])}return t}function u(e){let t=[],n=0,r=0;for(let i=0;i<e.length;i++){let a=c.indexOf(e[i]);if(a<0)throw new s(`caractère invalide`);n=n<<6|a,r+=6,r>=8&&(r-=8,t.push(n>>r&255),n&=(1<<r)-1)}if(r>=6)throw new s(`longueur invalide`);return t}function d(e,t){for(;t>=128;)e.push(t&127|128),t>>=7;e.push(t)}function f(e,t=21){let n=0,r=0;for(;;){let i=e();if(n+=(i&127)*(1<<r),!(i&128))return n;if(r+=7,r>t)throw new s(`entier trop long`)}}var p=4096;function m(e,t){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t))throw RangeError(`idiv attend des entiers sûrs (${e}, ${t})`);if(t===0)throw RangeError(`idiv : division par zéro`);return(e-e%t)/t+0}function h(e){return e>=1&&e<=3}function g(e){return e>=4&&e<=7}var _=2048,v=72e3,y=4*p,b=1792,x=5632,S=class extends Error{constructor(e){super(e),this.name=`LevelError`}},C={"#":1,".":0,S:0,F:0,C:0,o:0,O:0,x:2,"*":3,"^":4,v:5,"<":6,">":7},w=m(p,2),T=(e,t)=>({x:e*p+w,y:t*p+w});function E(e,t){let n=/^(\d+)(?:\.(\d{1,6}))?$/.exec(e);if(!n)throw new S(`${t} : « ${e} » n'est pas un nombre de tuiles`);let r=n[2]??``,i=1;for(let e=0;e<r.length;e++)i*=10;return m((Number(n[1])*i+(r?Number(r):0))*p*2+i,i*2)}function D(e,t,n){let r=t===`aller-retour`?[...e,...e.slice(1,-1).reverse()]:[...e],i=[],a=0;for(let e=0;e<r.length;e++){let t=r[e],n=r[(e+1)%r.length],o=(t.x>n.x?t.x-n.x:n.x-t.x)+(t.y>n.y?t.y-n.y:n.y-t.y);i.push(o),a+=o}let o=[0],s=0;for(let e=0;e<r.length;e++)s+=i[e],o.push(a===0?n:m(n*s,a));return{nodes:r,times:o}}function O(e){let t=e.replace(/\r/g,``).split(`
`);for(;t.length>0&&t[0].trim()===``;)t.shift();for(;t.length>0&&t[t.length-1].trim()===``;)t.pop();if(t.length===0)throw new S(`Niveau vide`);let n=t.findIndex(e=>e.trim()===``);n<0&&(n=t.length);let r=t.slice(0,n),i=t.slice(n),a=r[0].length,o=r.length;if(a>2048||o>512)throw new S(`Niveau trop grand (${a} × ${o}, au plus ${_} × 512)`);let s=[],c=[],l=[],u=[],d=[],f=[],p=[];for(let e=0;e<o;e++){let t=r[e];if(t.length!==a)throw new S(`Ligne ${e+1} : ${t.length} colonnes au lieu de ${a}`);for(let n=0;n<a;n++){let r=t[n],i=C[r];if(i===void 0)throw new S(`Ligne ${e+1}, colonne ${n+1} : caractère « ${r} » inconnu`);if(s.push(i),f.push(i===2?d.length:-1),i===2&&d.push({col:n,row:e}),r===`S`&&c.push({col:n,row:e}),r===`F`&&l.push({col:n,row:e}),r===`C`&&p.push({col:n,row:e}),r===`o`||r===`O`){let t=T(n,e);u.push({id:`${r}${u.length}`,radius:r===`o`?b:x,mode:`fixe`,points:[t],cycle:0,section:-1,nodes:[t],times:[0,0]})}}}p.sort((e,t)=>e.col-t.col||e.row-t.row);for(let e=1;e<p.length;e++)if(p[e].col===p[e-1].col)throw new S(`Deux points de passage « C » dans la colonne ${p[e].col+1} (un seul par colonne)`);if(c.length!==1)throw new S(`Il faut exactement un départ « S » (${c.length} trouvés)`);if(l.length!==1)throw new S(`Il faut exactement une arrivée « F » (${l.length} trouvées)`);let m=[],h=[];for(let e=0;e<i.length;e++){let t=i[e].trim();if(t===``||t.startsWith(`//`))continue;let r=t.split(/\s+/),o=`Annexe, ligne ${n+e+1}`;if(r[0]===`section`){let e=r.length===3?/^(\d+)-(\d+)$/.exec(r[2]):null;if(!e)throw new S(`${o} : « section <nom> <col0>-<col1> » attendu`);let t=Number(e[1]),n=Number(e[2]);if(t>n||n>=a)throw new S(`${o} : colonnes ${t}-${n} hors de la grille (0-${a-1})`);if(m.some(e=>e.name===r[1]))throw new S(`${o} : section « ${r[1]} » déjà déclarée`);let i=m.find(e=>t<=e.c1&&e.c0<=n);if(i)throw new S(`${o} : chevauche la section « ${i.name} »`);m.push({name:r[1],c0:t,c1:n})}else if(r[0]===`scie`)h.push({line:n+e+1,words:r});else throw new S(`${o} : déclaration « ${r[0]} » inconnue (section, scie)`)}for(let{line:e,words:t}of h){let n=`Annexe, ligne ${e}`;if(t.length<7)throw new S(`${n} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);let[,r,i,s,c]=t;if(u.some(e=>e.id===r))throw new S(`${n} : scie « ${r} » déjà déclarée`);let l=i===`o`?b:i===`O`?x:E(i,n);if(l<=0||l>y)throw new S(`${n} : rayon hors bornes (au plus 4 tuiles)`);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>72e3)throw new S(`${n} : cycle en pas attendu (1 à ${v})`);if(c!==`aller-retour`&&c!==`boucle`)throw new S(`${n} : mode « ${c} » inconnu (aller-retour, boucle)`);let d=t.slice(5).map(e=>{let t=/^(\d+),(\d+)$/.exec(e);if(!t)throw new S(`${n} : point « ${e} » (col,rangée) attendu`);let r={col:Number(t[1]),row:Number(t[2])};if(r.col>=a||r.row>=o)throw new S(`${n} : point ${e} hors de la grille`);return r});if(d.length>32)throw new S(`${n} : au plus 32 points`);let f=m.findIndex(e=>d[0].col>=e.c0&&d[0].col<=e.c1);if(f<0)throw new S(`${n} : le premier point (colonne ${d[0].col}) n'est dans aucune section`);let p=d.map(e=>T(e.col,e.row)),h=Number(s);u.push({id:r,radius:l,mode:c,points:p,cycle:h,section:f,...D(p,c,h)})}return{width:a,height:o,tiles:s,start:c[0],finish:l[0],sections:m,saws:u,crumbles:d,crumbleIndex:f,checkpoints:p}}function k(e,t,n){return n>=e.height?0:t<0||n<0||t>=e.width?1:e.tiles[n*e.width+t]}function A(e){return{x:e.col*p,y:e.row*p}}function j(e,t){if(e.cycle===0||t<=0)return e.nodes[0];let n=t%e.cycle,r=e.nodes.length,i=0;for(;i<r-1&&n>=e.times[i+1];)i++;let a=e.nodes[i],o=e.nodes[(i+1)%r],s=e.times[i],c=e.times[i+1]-s;return c<=0?a:{x:a.x+m((o.x-a.x)*(n-s),c),y:a.y+m((o.y-a.y)*(n-s),c)}}var ee=12;function M(e){return e>>ee}function te(e,t,n,r,i){for(let a=r;a<=i;a++)for(let r=t;r<=n;r++)if(h(k(e,r,a)))return!0;return!1}function ne(e,t,n,r,i){return te(e,M(t),M(t+r-1),M(n),M(n+i-1))}function re(e,t,n,r,i,a,o){if(r===0)return{pos:t,blocked:!1};let s=M(i),c=M(i+a-1),l=t=>o?te(e,t,t,s,c):te(e,s,c,t,t);if(r>0){let e=M(t+n-1)+1,i=M(t+n+r-1);for(let t=e;t<=i;t++)if(l(t))return{pos:t*p-n,blocked:!0}}else{let e=M(t)-1,n=M(t+r);for(let t=e;t>=n;t--)if(l(t))return{pos:(t+1)*p,blocked:!0}}return{pos:t+r,blocked:!1}}var N=3072,P=3072,F=2048,I=Object.freeze({runSpeed:375,groundAccel:17,groundDecel:32,airAccel:13,airDecel:6,gravity:19,fallSpeed:751,jumpSpeed:800,jumpCut:340,slideSpeed:171,wallJumpX:340,wallJumpY:680,wallLock:0,wallReach:512,coyote:10,wallCoyote:6,jumpBuffer:12,cornerTolerance:1024,crumbleDelay:30,springSpeed:1056}),ie=Object.keys(I);function ae(e){return ie.every(t=>e[t]===I[t])}function oe(e){let t=e.start.col*p+m(p-N,2),n=(e.start.row+1)*p-P,r=+!!ne(e,t,n+1,3072,3072);return{x:t,y:n,vx:0,vy:0,ground:r,air:r?0:255,wallSide:0,wallAir:255,slide:0,buffer:0,held:0,jumping:0,lock:0,lockDir:0}}function se(e){return e.ground?`sol`:e.slide===0?`air`:`mur`}var ce=(e,t,n)=>e<t?t:e>n?n:e,L=(e,t,n)=>e<t?e+n>t?t:e+n:e-n<t?t:e-n;function R(e,t,n,r,i){let a=M(n),o=M(n+P-1),s=r<0?t:t+N,c=r<0?M(t)-1:M(t+N-1)+1,l=M(r<0?t-i-1:t+N+i);for(let t=c;r<0?t>=l:t<=l;t+=r)for(let n=a;n<=o;n++)if(h(k(e,t,n)))return r<0?s-(t+1)*p:t*p-s;return-1}function le(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=r,a=(t&2?1:0)-(t&1?1:0),o=t&4?1:0,s=o===1&&e.held===0;e.lock>0&&a===e.lockDir&&(a=0);let c=e.lock>0?e.lock-1:0,l=c>0?e.lockDir:0,u=e.ground===1,d=u?i.groundAccel:i.airAccel,f=u?i.groundDecel:i.airDecel,m=e.vx;m=a===0?L(m,0,f):m*a<0?L(m,a*i.runSpeed,d>f?d:f):m*a>i.runSpeed?L(m,a*i.runSpeed,f):L(m,a*i.runSpeed,d);let g=e.vy,_=0;!u&&g>=0&&a!==0&&R(n,e.x,e.y,a,1)===0&&(_=a);let v=_===0?i.fallSpeed:i.slideSpeed;g=g<v?g+i.gravity>v?v:g+i.gravity:g-i.gravity<v?v:g-i.gravity;let y=e.air,b=e.wallAir,x=e.jumping,S=!1;if(s||e.buffer>0){if(u||e.air<=i.coyote)g=-i.jumpSpeed,S=!0,y=255;else{let t=R(n,e.x,e.y,-1,i.wallReach),r=R(n,e.x,e.y,1,i.wallReach),o=0;t>=0&&r>=0?o=a===0?t<=r?-1:1:a:t>=0?o=-1:r>=0?o=1:e.wallSide!==0&&e.wallAir<=i.wallCoyote&&(o=e.wallSide),o!==0&&(m=-o*i.wallJumpX,g=-i.wallJumpY,S=!0,_=0,b=255,c=i.wallLock,l=c>0?o:0)}}S&&(x=1);let C=S?0:s?i.jumpBuffer:e.buffer>0?e.buffer-1:0;x===1&&o===0&&g<-i.jumpCut&&(g=-i.jumpCut,x=0),g>=0&&(x=0),m=ce(m,-2048,F),g=ce(g,-2048,F);let w=e.x,T=e.y,E=re(n,w,N,m,T,P,!0);w=E.pos,E.blocked&&(m=0);let D=re(n,T,P,g,w,N,!1);if(D.blocked&&g<0&&i.cornerTolerance>0){let e=M(D.pos)-1,t=M(w),r=M(w+N-1),a=h(k(n,t,e)),o=h(k(n,r,e)),s=w;t!==r&&a&&!o&&(t+1)*4096-w<=i.cornerTolerance?s=(t+1)*p:t!==r&&o&&!a&&w+3072-r*4096<=i.cornerTolerance&&(s=r*p-N),s!==w&&!ne(n,s,T,3072,3072)&&(w=s,D=re(n,T,P,g,w,N,!1))}T=D.pos,D.blocked&&(g<0&&(x=0),g=0);let O=g>=0&&ne(n,w,T+1,3072,3072)?1:0;O?y=0:y<255&&(y+=1);let A=e.wallSide;if(O)A=0,b=255;else{let e=R(n,w,T,-1,1)===0,t=R(n,w,T,1,1)===0;e===t?e&&t?(A=a===0?A:a,b=0):b<255&&(b+=1):(A=e?-1:1,b=0)}return O&&(x=0),{x:w,y:T,vx:m+0,vy:g+0,ground:O,air:y,wallSide:A,wallAir:b,slide:_,buffer:C,held:o,jumping:x,lock:c,lockDir:l}}var ue=[`aucune`,`pic`,`scie`,`chute`],z=1024,B=2048;function de(e,t,n){let r=p,i=t*r,a=n*r,o=r-2*z;switch(e){case 4:return{x:i+z,y:a+r-B,w:o,h:B};case 5:return{x:i+z,y:a,w:o,h:B};case 6:return{x:i+r-B,y:a+z,w:B,h:o};case 7:return{x:i,y:a+z,w:B,h:o};default:throw RangeError(`spikeBox : la tuile ${e} n'est pas un pic`)}}function fe(e,t){return e.x<t.x+t.w&&t.x<e.x+e.w&&e.y<t.y+t.h&&t.y<e.y+e.h}var pe=(e,t,n)=>e<t?t:e>n?n:e;function me(e,t,n){let r=e-pe(e,n.x,n.x+n.w),i=t-pe(t,n.y,n.y+n.h);return r*r+i*i}function he(e,t,n,r){return me(e,t,r)<n*n}function V(e){return{status:0,time:0,player:oe(e),tiles:e.tiles,crumbles:e.crumbles.map(()=>0),sections:e.sections.map(()=>-1),deathCause:0,deathX:0,deathY:0,deathTicks:0,springCell:-1,springTime:0,checkpoint:-1}}function H(e,t){let n=e.checkpoints[t.checkpoint],r=t.sections.map((t,r)=>e.sections[r].c1>=n.col?-1:t);return{...V(e),status:1,time:t.time,player:oe({...e,start:n}),sections:r,checkpoint:t.checkpoint}}function ge(e,t,n){let r=e.saws[n];if(r.section<0)return 0;let i=t.sections[r.section];return i<0?0:t.time-i}function _e(e,t){return e.saws.map((n,r)=>j(n,ge(e,t,r)))}function ve(e){return{x:e.x,y:e.y,w:N,h:P}}function ye(e,t){let n=t.player;if(n.y+3072>e.height*4096)return 3;let r=ve(n),i=M(n.x),a=M(n.x+N-1),o=M(n.y)<0?0:M(n.y),s=M(n.y+P-1);for(let t=o;t<=s;t++)for(let n=i;n<=a;n++){if(n<0||n>=e.width)continue;let i=e.tiles[t*e.width+n];if(g(i)&&fe(r,de(i,n,t)))return 1}for(let n=0;n<e.saws.length;n++){let i=e.saws[n],a=j(i,ge(e,t,n));if(he(a.x,a.y,i.radius,r))return 2}return 0}function be(e,t){let n=p;return fe(ve(t),{x:e.finish.col*n,y:e.finish.row*n,w:n,h:n})}function xe(e,t){return t===e.tiles?e:{width:e.width,height:e.height,tiles:t}}function Se(e,t,n){return t<0||n<0||t>=e.width||n>=e.height?-1:n*e.width+t}function U(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=t&4?1:0;if(e.status===3)return e;if(e.status===2){let t=e.deathTicks+1,r=e.checkpoint>=0?e.time+1:e.time;if(t<18)return{...e,deathTicks:t,time:r};if(e.checkpoint>=0){let t=H(n,{...e,time:r});return i&&(t.player={...t.player,held:1}),t}let a=V(n);return i&&(a.player={...a.player,held:1}),a}if(e.status===0){let n=t&3;if(!(n===1||n===2||i===1&&e.player.held===0))return e.player.held===i?e:{...e,player:{...e.player,held:i}}}let a=p,o=e.tiles,s=e.crumbles;for(let t=0;t<s.length;t++){let r=s[t];if(!(r<=0)&&(s===e.crumbles&&(s=[...s]),s[t]=r>1?r-1:-1,r===1)){o===e.tiles&&(o=[...o]);let r=n.crumbles[t];o[r.row*n.width+r.col]=0}}let c=le(e.player,t,xe(n,o),r),l=c.ground===1,u=M(c.x),d=M(c.x+N-1),f=e.springCell,h=e.springTime;if(l&&r.springSpeed>0){let t=M(c.y+P),i=M(c.x+m(N,2)),a=-1;for(let e of[i,u,d]){let r=Se(n,e,t);if(r>=0&&o[r]===3){a=r;break}}if(a>=0){let t=r.springSpeed<2048?r.springSpeed:F;c={...c,vy:-t,ground:0,air:255,jumping:0,buffer:0},f=a,h=e.time+1}}let g=(t,i)=>{let a=Se(n,t,i);if(a<0)return;let o=n.crumbleIndex[a];o<0||s[o]!==0||(s===e.crumbles&&(s=[...s]),s[o]=r.crumbleDelay>1?r.crumbleDelay:1)};if(l){let e=M(c.y+P);for(let t=u;t<=d;t++)g(t,e)}else{let e=(t&2?1:0)-(t&1?1:0),n=M(c.y),r=M(c.y+P-1);if(e>0&&(c.x+3072)%a===0)for(let e=n;e<=r;e++)g(M(c.x+N),e);if(e<0&&c.x%a===0)for(let e=n;e<=r;e++)g(M(c.x)-1,e)}let _=e.time+1,v=e.sections,y=M(c.x+m(N,2));for(let t=0;t<v.length;t++){let r=n.sections[t];v[t]>=0||y<r.c0||y>r.c1||(v===e.sections&&(v=[...v]),v[t]=_)}let b={...e,status:1,time:_,player:c,tiles:o,crumbles:s,sections:v,springCell:f,springTime:h};if(be(n,c))return{...b,status:3};let x=ye(n,b);if(x!==0)return{...b,status:2,deathCause:x,deathX:c.x+m(N,2),deathY:c.y+m(P,2),deathTicks:0};let S=M(e.player.x+m(N,2));if(y>S){let e=b.checkpoint;for(let t=0;t<n.checkpoints.length;t++){let r=n.checkpoints[t].col;S<r&&r<=y&&(e=t)}if(e!==b.checkpoint)return{...b,checkpoint:e}}return b}var Ce=O(`
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#....................................................................................................................................................................................................#
#..................................................................................................................................................................##................................#
#..................................................................................................................................................................##................................#
#..................................................................................................................................................................##................................#
#........................####......................................................................................................................................##................................#
#..................................................................................................................................................##...##..##.....##................................#
#..................................................................................................................................................##...##..##.....##................................#
#...................####...........................................................................................................................##...##..##.....##................................#
#..................................................................................................................................................##...##..##.....##........#####...................#
#....................................................................................................................................##########....##...##..##.....##................................#
#..............####..................................................................................................................##########....##...##..##.....##................................#
#....................................................................................................................................##########....##...##..##.....##................................#
#...............................................##########.........................................................####..............##########....##...##..##.....##......####.####..####.##........#
#.........####.............................##...##########.......######.....................................................###......##########....##...##..##.....##................................#
#.....................................##...##...##########.......######..............................................................##########....##...##..##.....##................................#
#..S.............................##...##...##...##########.......######............................................................................................##............................F...#
##########################################################.......##########..####...####....####.....####......####....#####...#######################################################################
##########################################################.......##########..####...####....####.....####......####....#####...#######################################################################
######################################################################################################################################################################################################
`);Object.freeze({floorRow:26,start:3,steps:[[33,1],[38,2],[43,3],[48,4]],coyoteLedge:57,gaps:[[75,2],[81,3],[88,4],[96,5],[105,6]],lowGaps:[[115,4,23],[124,3,24]],corridor:[133,10],chimneys:[[149,3],[154,2]],chimneyTopRow:16,wall:[163,12],slab:[171,18],slabHoles:[175,180,181,186],finish:193});var we=O(`
#..................................................................................................................................................................................................................................#
#......................................................................................................................................................................................#############################################
#......................................................................................................................................................................................#############################################
#......................................................................................................................................................................................#############################################
#......................................................................................................................................................................................#############################################
#............................................................................................................................................................................................vvvvvvvvvvvvvvvvvvvvvvvv..............#
#..................................................................................................................................................................................................................................#
#..................................................................................................................................................................................................................................#
#...........................................................................................................................................................................................C...^^....^^^....^^.............F......#
#..........................................................................................................................................................................................#######################xxxx##############
#..........................................................................................................................................................................................#######################....##############
#..........................................................................................................................................................................................#######################....##############
#...................................................####...................................................................................................................................#######################....##############
#......................................................#......C............................................................................................................................#######################....##############
#......................................................#...########xxx...xxx...xxx...xxx...................................................................................................#######################....##############
#......................................................#...#........................................................................................................................####*..#######################....##############
#......................................................#...#........................................................................................................................#####..#######################....##############
#......................................................#...#..................................o.....................................................................................#####..#######################....##############
#......................................................#...#...............................xxxxxxxx................................................................................<#####..#######################....##############
#......................................................#...#.......................................#####...........................................................................<#####..#######################....##############
#......................................................#...#.......................................#####...........................................................................<#####..#######################....##############
#......................................#####...........#...#.......................................#####...................^^^^^^^^^^^^^^^^^.................O..............####*...#####..#######################....##############
#......................................#####>..........#...#.......................................#####..................###################...............................#####...#####..#######################....##############
#......................................#####>..........#...#.......................................#####......###...###............................###......................#####...#####..#######################....##############
#......................................#####...........#...#.......................................#####......###...###............................###......................#####...#####..#######################....##############
#........................####..........#####...........#...#.......................................#####......###...###............................###......................#####...#####..#######################....##############
#..S.......^^............####...o......#####^^^^^^.C.......#.......................................#####..C...###...###............................###.................C....#####...#####..#######################....##############
##################....###############*######################.......................................########################################################....###########*#######################################....##############
##################....######################################.......................................########################################################....###################################################....##############
##################....######################################.......................................########################################################....###################################################....##############

section echauffement 0-49
section murs 50-103
section scies 104-165
section final 166-227
scie ascenseur o 150 aller-retour 114,18 114,26
scie couloir o 200 aller-retour 139,26 123,26
scie ronde o 240 boucle 146,22 150,22 150,26 146,26
`),Te=O(`
#..................................................................................................................................#
#..................................................................................................................................#
#..................................................................................................................................#
#..................................................................................................................................#
#..................................................................................................................................#
#..................................................................................................................................#
#..................................................................................................................................#
#..................................................................................................................................#
#.............................................................................................................................F....#
#...............................................................................................................####################
#...............#######.........................................................................................####################
#................vvvvv...........................O..............................................................####################
#................................................................................##.............................####################
#............................<##>................................................##.............................####################
#..S.....^^...................##........o...............C........................##...........................*.####################
##############################################################################################xxxxxxxx##############################
##############################################################################################........##############################
##############################################################################################........##############################

section depart 0-24
section pics-lateraux 25-35
section scies-fixes 36-53
section aller-retour 54-73
section boucle 74-89
section friables 90-104
section ressort 105-131
scie va-et-vient o 240 aller-retour 59,14 69,14
scie ronde o 300 boucle 80,11 83,11 83,14 80,14
`),W=72e3,Ee=/^[a-z0-9_:-]{1,40}$/,De=256,Oe=4096,ke=1,Ae=2,je=4,G=class extends Error{code;constructor(e,t){super(t),this.code=e,this.name=`JumpReplayError`}},Me=Object.freeze({checkpoint:-1,held:0,time:0,sections:Object.freeze([]),elan:0});function Ne(e){let t=0;for(let n of e)t+=n.count;return t}function Pe(e){let t=[];for(let n of e){let e=t[t.length-1];e&&e.bits===n?e.count++:t.push({count:1,bits:n})}return t}function Fe(e){let t=[];for(let n of e)for(let e=0;e<n.count;e++)t.push(n.bits);return t}function Ie(e){if(!Ee.test(e))throw new G(`format`,`Identifiant de niveau invalide : « ${e} »`)}function Le(e){Ie(e.levelId);let t=e.start,n=[1];d(n,e.simVersion),n.push(e.levelId.length);for(let t=0;t<e.levelId.length;t++)n.push(e.levelId.charCodeAt(t));let r=t.checkpoint>=0;if(r&&t.elan)throw new G(`format`,`Départ lancé sur un point de passage`);if(n.push((t.held?ke:0)|(r?Ae:0)|(t.elan?je:0)),r){d(n,t.checkpoint),d(n,t.time),d(n,t.sections.length);for(let e of t.sections)d(n,e+1)}let i=0;for(let t of e.runs){if(!Number.isInteger(t.count)||t.count<1)throw new G(`format`,`Série vide`);if(!Number.isInteger(t.bits)||t.bits<0||t.bits>7)throw new G(`format`,`Commande invalide : ${t.bits}`);if(i+=t.count,i>W)throw new G(`length`,`Rediffusion trop longue (plus de ${W} pas)`);d(n,t.count*8+t.bits)}return l(n)}function Re(e){if(typeof e!=`string`||e.length===0)throw new G(`format`,`Rediffusion vide`);let t;try{t=u(e)}catch(e){throw e instanceof s?new G(`format`,`Rediffusion illisible (${e.message})`):e}let n=0,r=()=>{let e=t[n++];if(e===void 0)throw new G(`format`,`Rediffusion tronquée`);return e},i=e=>{try{return f(r)}catch(t){throw t instanceof s?new G(`format`,`${e} : entier trop long`):t}},a=r();if(a!==1)throw new G(`format`,`Format de rediffusion inconnu (${a})`);let o=i(`Version`),c=r(),l=``;for(let e=0;e<c;e++)l+=String.fromCharCode(r());Ie(l);let d=r();if(d&-8)throw new G(`format`,`Drapeaux de départ inconnus`);if(d&Ae&&d&je)throw new G(`format`,`Départ lancé sur un point de passage`);let p={checkpoint:-1,held:d&ke?1:0,time:0,sections:[],elan:d&je?1:0};if(d&Ae){let e=i(`Point de passage`),t=i(`Chrono`),n=i(`Sections`);if(e>=Oe)throw new G(`format`,`Point de passage hors limites`);if(t>W)throw new G(`length`,`Chrono de départ trop long`);if(n>De)throw new G(`format`,`Trop de sections`);let r=[];for(let e=0;e<n;e++){let e=i(`Section`)-1;if(e>t)throw new G(`format`,`Section mise en marche après le départ`);r.push(e)}p.checkpoint=e,p.time=t,p.sections=r}let h=[],g=0;for(;n<t.length;){let e=i(`Série`),t=e%8,n=m(e-t,8);if(n<1)throw new G(`format`,`Série vide`);if(g+=n,g>W)throw new G(`length`,`Rediffusion trop longue (plus de ${W} pas)`);h.push({count:n,bits:t})}return{simVersion:o,levelId:l,start:p,runs:h}}function K(e,t){if(t.checkpoint<0){let n=V(e);return!t.held&&!t.elan?n:{...n,player:{...n.player,held:+!!t.held,vx:t.elan?I.runSpeed:0}}}if(t.elan)throw new G(`format`,`Départ lancé sur un point de passage`);if(t.checkpoint>=e.checkpoints.length)throw new G(`level`,`Point de passage ${t.checkpoint} absent de ce niveau`);if(t.sections.length!==e.sections.length)throw new G(`level`,`Nombre de sections différent de celui du niveau`);let n=H(e,{...V(e),checkpoint:t.checkpoint,time:t.time,sections:t.sections});return t.held?{...n,player:{...n.player,held:1}}:n}function ze(e){return{checkpoint:e.checkpoint,held:e.player.held,time:e.time,sections:[...e.sections],elan:0}}function Be(e,t,n){if(t.simVersion!==3)throw new G(`version`,`Rediffusion d'une autre version de la simulation (${t.simVersion}, actuelle 3)`);if(n!==void 0&&t.levelId!==n)throw new G(`level`,`Rediffusion d'un autre niveau (« ${t.levelId} »)`);if(Ne(t.runs)>W)throw new G(`length`,`Rediffusion trop longue (plus de ${W} pas)`);return K(e,t.start)}function Ve(e,t){return t.status===3||t.status===2&&e.status!==2&&t.checkpoint<0}function He(e,t,n){let r=Be(e,t,n),i=[],a=[],o={start:{...t.start,sections:[...t.start.sections]},startTick:0,runs:[],ticks:0},s=0,c=!1;for(let n of t.runs)for(let t=0;t<n.count;t++){if(c)throw new G(`format`,`Pas après la fin de l'essai (pas ${s+1})`);let t=r;if(r=U(t,n.bits,e,I),s++,o){let e=o.runs[o.runs.length-1];e&&e.bits===n.bits?e.count++:o.runs.push({count:1,bits:n.bits}),o.ticks++}if(r.status===2&&t.status!==2){let e={cause:r.deathCause,x:r.deathX,y:r.deathY};i.push({tick:s,time:r.time,...e,life:a.length}),o&&a.push({index:a.length,...o,end:`mort`,death:e}),o=null}else r.status===1&&t.status===2?o={start:ze(r),startTick:s,runs:[],ticks:0}:r.status===3&&t.status!==3&&o&&(a.push({index:a.length,...o,end:`arrivée`,death:null}),o=null);Ve(t,r)&&(c=!0)}return o&&o.ticks>0&&a.push({index:a.length,...o,end:`abandon`,death:null}),{finished:r.status===3,ticks:s,time:r.time,deaths:i,lives:a,final:r}}function Ue(e,t){return{simVersion:e.simVersion,levelId:e.levelId,start:t.start,runs:t.runs.map(e=>({...e}))}}var We=class{level;replay;state;prev;tick=0;total;run=0;left;constructor(e,t){this.level=e,this.replay=t,this.state=Be(e,t),this.prev=this.state,this.total=Ne(t.runs),this.left=t.runs[0]?.count??0}get done(){return this.tick>=this.total}next(){let e=this.replay.runs[this.run];return e?(this.left--,this.left===0&&(this.run++,this.left=this.replay.runs[this.run]?.count??0),e.bits):0}step(){return this.done?(this.prev=this.state,!1):(this.prev=this.state,this.state=U(this.state,this.next(),this.level,I),this.tick++,!0)}},Ge=class{levelId;inputs=[];count=0;held=0;active=!1;skipping=!1;constructor(e){this.levelId=e,Ie(e)}get recording(){return this.active}get ticks(){return this.count}step(e,t,n){if(this.skipping){if(n.status!==0)return null;this.skipping=!1}if(!this.active){if(e.status!==0||n.status===0)return null;this.active=!0,this.inputs=[],this.count=0,this.held=e.player.held}if(this.count>=W)return this.active=!1,this.skipping=!0,this.inputs=[],this.count=0,null;let r=this.inputs[this.inputs.length-1];return r&&r.bits===t?r.count++:this.inputs.push({count:1,bits:t}),this.count++,n.status===3?this.close(`arrivée`):Ve(e,n)?this.close(`mort`):null}abandon(){return this.skipping=!1,!this.active||this.count===0?(this.active=!1,null):this.close(`abandon`)}peek(){return!this.active||this.count===0?null:this.replayOf()}replayOf(){return{simVersion:3,levelId:this.levelId,start:{...Me,held:this.held},runs:this.inputs.map(e=>({...e}))}}close(e){let t=this.replayOf();return this.active=!1,this.inputs=[],this.count=0,{replay:t,end:e}}};function q(e,t){return Math.imul(e^(t|0),16777619)>>>0}function Ke(e,t){let n=new We(e,t),r=2166136261,i=0;for(;n.step();){let e=n.state,t=e.player;for(let e of[t.x,t.y,t.vx,t.vy,t.ground,t.air,t.wallSide,t.wallAir,t.slide,t.buffer,t.held,t.jumping,t.lock,t.lockDir])r=q(r,e);for(let t of[e.status,e.time,e.deathCause,e.deathX,e.deathY,e.deathTicks,e.springCell,e.springTime,e.checkpoint])r=q(r,t);for(let t of e.crumbles)r=q(r,t);for(let t of e.sections)r=q(r,t);e.status===2&&n.prev.status!==2&&i++}return{hash:r.toString(16).padStart(8,`0`),finished:n.state.status===3,ticks:n.tick,time:n.state.time,deaths:i}}var qe=480,J=e=>M(e.player.x+m(N,2));function Je(e,t){let n=Fe(t.runs),r=[],i=e.checkpoints.map(()=>-1),a=K(e,t.start);for(let t=0;t<n.length;t++)a=U(a,n[t],e,I),a.checkpoint>=0&&i[a.checkpoint]===-1&&(i[a.checkpoint]=t+1,r[a.checkpoint]=a);return{inputs:n,resume:i.map((t,i)=>{if(t<0)return-1;let a=H(e,r[i]),o=t,s=-1;for(let r=t-120<0?0:t-120;r<=t+30&&r<n.length;r+=2){let t=a,i=J(t);for(let a=0;a<360&&r+a<n.length&&(t=U(t,n[r+a],e,I),t.status===1);a++){let e=J(t);e>i&&(i=e)}t.status===3&&(i+=1e4),i>s&&(s=i,o=r)}return o})}}function Ye(t,n,r,i){let a=new e(r),o=Je(t,n),s=i.maxLives??6,c=K(t,n.start),l=[],u=(e,t)=>{let n=e+a.int(t);return[n,n+4+a.int(37),a.int(8)]};for(let e=0;e<i.attempts;e++){let e=[u(0,a.chance(50)?m(o.inputs.length,3):o.inputs.length)],r=new Ge(n.levelId),i=c,d=0,f=1,p=J(i),h=0,g=null;for(;;){let n=o.inputs[d]??0;for(let[t,r,i]of e)d>=t&&d<r&&(n=i);let c=i;if(i=U(c,n,t,I),g=r.step(c,n,i),g)break;d++;let l=J(i);if(l>p)p=l,h=0;else if(++h>qe){g=r.abandon();break}if(i.status===1&&c.status===2){if(++f>s){g=r.abandon();break}d=o.resume[i.checkpoint]??0,d<0&&(d=0),h=0,p=J(i),a.chance(70)&&e.push(u(d,360))}}g&&l.push(g)}return l}var Xe=`id: ascenseur
intention: Franchir un fossé où une scie monte et descend : sauter quand elle est en bas.
etiquettes: scie
format: 2
paliers: 10 10
repeter: trou colonnes 11-11
variante: trou=1 cycle=240
variante: trou=1 cycle=180
variante: trou=2 cycle=240
grille:
......................
......................
......................
......................
......................
......................
......................
......................
......................
......................
#########...##########
#########...##########
#########...##########
#########...##########
#########...##########

scie ascenseur o {cycle} aller-retour 10,13 10,3
(id: cheminee-pics
intention: Monter une cheminée dont chaque mur porte une plaque de pics : choisir le bon mur à chaque hauteur.
etiquettes: mural precision vertical
format: 2
paliers: 17 6
repeter: plaque rangees 13-13
repeter: plaque rangees 8-8
repeter: couloir colonnes 1-1
variante: plaque=1 couloir=1
variante: plaque=2 couloir=2
variante: plaque=0 couloir=2
grille:
######..........
######..........
######..........
######..........
######..........
######..........
######...#######
######>..#######
######>..#######
######...#######
######...#######
######...#######
######..<#######
.#####..<#######
.#####...#######
.........#######
.........#######
################
################
################
(id: cheminee-scie
intention: Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment.
etiquettes: mural scie vertical
format: 2
paliers: 17 6
repeter: haut rangees 10-10
variante: haut=1 cycle=390
variante: haut=1 cycle=480
variante: haut=1 cycle=420
variante: haut=2 cycle=360
grille:
######..........
######..........
######..........
######..........
######..........
######..........
######...#######
######...#######
######...#######
######...#######
######...#######
######...#######
######...#######
.#####...#######
.#####...#######
.........#######
.........#######
################
################
################

scie va-et-vient o {cycle} aller-retour 7,2 7,8
(id: cheminee
intention: Monter une cheminée en sautant d'un mur à l'autre, puis sortir par le haut.
etiquettes: mural vertical
format: 2
paliers: 17 6
repeter: large colonnes 9-9
repeter: haut rangees 10-10
variante: large=1 haut=1
variante: large=2 haut=3
variante: large=2 haut=6
grille:
########.........
########.........
########.........
########.........
########.........
########.........
########..#######
########..#######
########..#######
########..#######
########..#######
########..#######
########..#######
.#######..#######
.#######..#######
..........#######
..........#######
#################
#################
#################
(id: demi-tour
intention: Sauter contre le bas d'un mur hérissé, rebondir en arrière sur une corniche, puis repartir par-dessus le mur.
etiquettes: mural
format: 2
paliers: 15 8
repeter: ecart colonnes 10-10
variante: ecart=1
variante: ecart=2
variante: ecart=4
grille:
....................
....................
....................
....................
....................
....................
....................
....................
.............#######
............<#######
......###...<#######
............<#######
.............#######
.............#######
.............#######
####################
####################
(id: descente
intention: Se laisser tomber de corniche en corniche jusqu'en bas, sans freiner.
etiquettes: respiration
format: 2
paliers: 4 16
repeter: large colonnes 4-4
repeter: large colonnes 7-7
repeter: large colonnes 10-10
repeter: large colonnes 13-13
repeter: large colonnes 16-16
variante: large=1
variante: large=2
variante: large=4
grille:
....................
....................
....................
....................
##..................
##..................
#####...............
#####...............
########............
########............
###########.........
###########.........
##############......
##############......
#################...
#################...
####################
####################
####################
####################
(id: escalier-friable
intention: Gravir un escalier de blocs friables suspendu au-dessus du vide, d'une seule traite.
etiquettes: friable vertical
format: 2
paliers: 17 7
repeter: large colonnes 5-5
repeter: large colonnes 9-9
repeter: large colonnes 13-13
repeter: large colonnes 17-17
variante: large=1
variante: large=2
grille:
........................
........................
........................
........................
........................
........................
........................
....................####
....................####
................xxx.####
....................####
............xxx.....####
....................####
........xxx.........####
....................####
....xxx.............####
....................####
###.................####
###.................####
###.................####
(id: escalier
intention: Gravir un escalier de grandes marches, un bond par marche, sans casser son élan.
etiquettes: respiration vertical
format: 2
paliers: 12 4
repeter: large colonnes 4-4
repeter: large colonnes 7-7
repeter: large colonnes 10-10
repeter: large colonnes 13-13
variante: large=1
variante: large=2
variante: large=3
grille:
......................
......................
......................
......................
...........###########
...........###########
........##############
........##############
.....#################
.....#################
..####################
..####################
######################
######################
(id: grande-scie
intention: Sauter un trou sous une grande scie : un petit saut passe, un grand s'y jette.
etiquettes: scie precision
format: 2
paliers: 10 10
repeter: trou colonnes 9-9
variante: trou=1
variante: trou=2
variante: trou=3
grille:
......................
......................
......................
......................
......................
......................
..........O...........
......................
......................
......................
#########...##########
#########...##########
#########...##########
(id: iles-friables
intention: Sauter d'îlot friable en îlot friable, chacun un peu plus haut, sans jamais s'y poser longtemps.
etiquettes: friable precision
format: 2
paliers: 12 7
repeter: ecart colonnes 4-4
repeter: ecart colonnes 9-9
repeter: ecart colonnes 14-14
repeter: ecart colonnes 19-19
repeter: ecart colonnes 22-22
variante: ecart=1
variante: ecart=2
grille:
........................
........................
........................
........................
........................
........................
........................
.......................#
....................xx.#
...............xx......#
..........xx...........#
.....xx................#
###....................#
###....................#
###....................#
(id: lucarne
intention: Passer d'un saut par la petite fenêtre de deux murs minces.
etiquettes: precision
format: 2
paliers: 10 10
repeter: fenetre rangees 6-6
variante: fenetre=2
variante: fenetre=1
grille:
.........#.........#......
.........#.........#......
.........#.........#......
.........#.........#......
.........#.........#......
.........#................
..........................
...................#......
.........#.........#......
.........#.........#......
##########################
##########################
(id: mur-friable
intention: Monter une cheminée au-dessus d'un puits de pics : son mur gauche s'effrite, pas question de traîner.
etiquettes: mural friable vertical
format: 2
paliers: 17 7
repeter: haut rangees 10-10
variante: haut=1
variante: haut=3
variante: haut=5
grille:
######.........
######.........
######.........
#####x.........
#####x.........
#####x.........
#####x.........
#####x..#######
#####x..#######
#####x..#######
#####x..#######
#####x..#######
#####x..#######
.####x..#######
.####x..#######
........#######
........#######
######..#######
######..#######
######^^#######
###############
(id: mur-seul
intention: Remonter un grand mur tout seul, saut mural après saut mural, en revenant vers lui.
etiquettes: mural vertical
format: 2
paliers: 12 6
repeter: haut rangees 9-9
variante: haut=1
variante: haut=3
variante: haut=5
grille:
...........
...........
...........
...........
...........
...........
.......####
.......####
.......####
.......####
.......####
.......####
###########
###########
(id: petits-trous
intention: Sauter trois petits trous en courant, sans lever le pied de l'accélérateur.
etiquettes: respiration
format: 2
paliers: 8 8
repeter: trou colonnes 4-4
repeter: trou colonnes 12-12
repeter: trou colonnes 21-21
variante: trou=1
variante: trou=2
variante: trou=3
grille:
..........................
..........................
..........................
..........................
..........................
..........................
..........................
..........................
####.#######.########.####
####.#######.########.####
####.#######.########.####
(id: piliers
intention: Bondir de pilier en pilier, chacun large d'une seule tuile, au-dessus du vide.
etiquettes: precision
format: 2
paliers: 10 10
repeter: ecart colonnes 5-5
repeter: ecart colonnes 9-9
repeter: ecart colonnes 13-13
repeter: ecart colonnes 17-17
repeter: ecart colonnes 21-21
variante: ecart=1
variante: ecart=2
grille:
........................
........................
........................
........................
........................
........................
........................
........................
........................
..........#.......#.....
###...#...#...#...#...##
###...#...#...#...#...##
###...#...#...#...#...##
###...#...#...#...#...##
(id: plafond-pics
intention: Courir sous un plafond hérissé et enjamber les pics du sol par petits sauts : un grand saut s'y empale.
etiquettes: precision
format: 2
paliers: 10 10
repeter: pics colonnes 8-8
repeter: pics colonnes 14-14
repeter: pics colonnes 20-20
variante: pics=1
variante: pics=2
variante: pics=3
grille:
....####################....
....####################....
....####################....
....####################....
....####################....
....####################....
....vvvvvvvvvvvvvvvvvvvv....
............................
............................
........^.....^.....^.......
############################
############################
(// Respiration : un plat, une marche, encore un plat.
id: plaine
intention: Courir sur un plat et monter une marche basse : de quoi reprendre son souffle.
etiquettes: respiration
format: 2
paliers: 9 8
repeter: long colonnes 3-3
variante: long=6
variante: long=12
variante: long=18
grille:
..................
..................
..................
..................
..................
..................
..................
..................
.........#########
##################
##################
##################
(id: pont-friable
intention: Traverser un pont qui s'effondre derrière soi, sans jamais s'arrêter.
etiquettes: friable
format: 2
paliers: 9 9
repeter: long colonnes 10-10
variante: long=1
variante: long=5
variante: long=9
grille:
......................
......................
......................
......................
......................
......................
......................
......................
......................
#####xxxxxxxxxxxx#####
#####............#####
#####............#####
(id: puits
intention: Se laisser glisser contre le mur d'un puits pour ne pas manquer la porte de sortie, au-dessus des pics du fond.
etiquettes: mural vertical
format: 2
paliers: 4 18
repeter: large colonnes 4-4
repeter: prof rangees 9-9
variante: large=1 prof=1
variante: large=2 prof=4
variante: large=1 prof=7
grille:
......#########
......#########
......#########
......#########
###...#########
###...#########
###...#########
###...#########
###...#########
###...#########
###...#########
###...#########
###...#########
###...#########
###............
###............
###............
###............
###...#########
###^^^#########
###############
###############
(id: quinconce
intention: Passer entre des scies en quinconce : sauter celles du sol, rester sous celles du haut.
etiquettes: scie precision
format: 2
paliers: 11 11
repeter: ecart colonnes 8-8
repeter: ecart colonnes 11-11
repeter: ecart colonnes 14-14
repeter: ecart colonnes 17-17
repeter: ecart colonnes 20-20
variante: ecart=2
variante: ecart=3
grille:
...####################...
...####################...
...####################...
...####################...
...####################...
...####################...
..........................
.........o.....o.....o....
..........................
..........................
......o.....o.....o.......
##########################
##########################
(id: ressort-mur
intention: Prendre le ressort au pied d'un mur hérissé et retomber sur son sommet, sans frôler les pics.
etiquettes: ressort vertical
format: 2
paliers: 19 13
repeter: ecart colonnes 8-8
variante: ecart=1
variante: ecart=2
grille:
................
................
................
................
................
................
................
................
................
................
................
................
................
...........#####
..........<#####
..........<#####
..........<#####
..........<#####
..........<#####
######*#########
################
################
(id: ressort-plafond
intention: Le ressort lance sous un plafond à pics : arriver assez vite pour le dépasser et se poser sur la corniche.
etiquettes: ressort precision
format: 2
paliers: 18 13
repeter: bord colonnes 7-7
variante: bord=1
variante: bord=2
variante: bord=4
grille:
....................
....................
....................
....................
....................
....................
....................
....................
....................
..######............
..######............
..vvvvvv............
....................
..........##########
..........##########
..........##########
..........##########
..........##########
######*#############
####################
####################
(id: ressorts-trous
intention: Rebondir de ressort en ressort au-dessus d'une fosse à pics, sans lâcher la course.
etiquettes: ressort precision
format: 2
paliers: 13 13
repeter: ecart colonnes 12-12
repeter: ecart colonnes 23-23
repeter: ecart colonnes 34-34
variante: ecart=1
variante: ecart=2
grille:
........................................
........................................
........................................
........................................
........................................
........................................
........................................
........................................
........................................
........................................
........................................
........................................
........................................
####^^***^^^^^^^^***^^^^^^^^***^^^^^^###
########################################
########################################
(id: saut-long
intention: Prendre tout son élan et franchir un grand trou d'un seul saut.
etiquettes: precision
format: 2
paliers: 9 9
repeter: trou colonnes 8-8
variante: trou=5
variante: trou=6
variante: trou=7
grille:
......................
......................
......................
......................
......................
......................
......................
......................
......................
########.#############
########.#############
########.#############
(id: scie-ronde
intention: Passer sous un bloc suspendu pendant que la scie qui en fait le tour est au-dessus.
etiquettes: scie
format: 2
paliers: 10 10
variante: cycle=240
variante: cycle=180
variante: cycle=135
grille:
........................
........................
........................
........................
........................
........................
..........##............
..........##............
........................
........................
########################
########################
########################

scie ronde o {cycle} boucle 9,5 12,5 12,9 9,9
(id: scie-sol
intention: Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires.
etiquettes: scie
format: 2
paliers: 10 10
variante: cycle=300
variante: cycle=240
variante: cycle=180
grille:
...##################...
...##################...
...##################...
...##################...
...##################...
...##################...
...##################...
........................
........................
........................
########################
########################

scie patrouille o {cycle} aller-retour 5,9 18,9
scie contre o {cycle} aller-retour 18,9 5,9
(id: tunnel
intention: Traverser un tunnel bas en courant : un saut s'y cognerait la tête.
etiquettes: respiration
format: 2
paliers: 9 9
repeter: long colonnes 9-9
variante: long=4
variante: long=10
variante: long=16
grille:
....############....
....############....
....############....
....############....
....############....
....############....
....############....
....................
....................
####################
####################
####################
`.split(`(`),Ze={jumpSimVersion:3,exigenceVersion:2,modules:{ascenseur:{variants:[{grid:`d01912e7`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowANIGRrIL`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowBPIFTroL`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`e5cec0c8`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxANoGNroL`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,915,775],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxBIoGLsIL`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,810,665],raccord:1e3,exigence:2}},{grid:`4c10a79c`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyAPIGZsoL`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyBNIGTrIL`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"cheminee-pics":{variants:[{grid:`7004484a`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MADKBRidAgjGASJmRSBFRuIH`,ticks:320,entryTick:0,exitTick:313,fastest:313,gigue:[885,435,130],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MASSA8YBIBSNAgktXjw5VjxJPcYHYg`,ticks:309,entryTick:17,exitTick:302,fastest:286,gigue:[535,410,280],raccord:1e3,exigence:5}},{grid:`f7b4670e`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQCyBjjdASBeUjSBARK2ARiVASI1kgg`,ticks:368,entryTick:0,exitTick:361,fastest:355,gigue:[990,650,380],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQTSBTCdASYQPF44HRJ5vgESNG0SHbII`,ticks:349,entryTick:17,exitTick:342,fastest:325,gigue:[775,370,155],raccord:1e3,exigence:5}},{grid:`e77d3dc4`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgCqBhghpQEKlgEqpQES9gdK`,ticks:309,entryTick:0,exitTick:302,fastest:297,gigue:[1e3,770,480],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgTSBTCNAQq-AQg8hQEKPvIH`,ticks:295,entryTick:17,exitTick:288,fastest:269,gigue:[845,490,265],raccord:1e3,exigence:4}}]},"cheminee-scie":{variants:[{grid:`474a9ac6`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MADKBSjlAQmWAQpOxQEIJEbaBw`,ticks:311,entryTick:0,exitTick:304,fastest:304,gigue:[980,600,330],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MATyBDBMhQEpjgEqRTZtIvYHQg`,ticks:301,entryTick:17,exitTick:294,fastest:277,gigue:[610,235,110],raccord:1e3,exigence:5}},{grid:`4cbcc92a`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQCCBIYBQJUCCvYBOg6tASYpEESCCA`,ticks:329,entryTick:0,exitTick:322,fastest:320,gigue:[995,830,620],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQTyBCgk3QEIrAEyhAGlAQj2B0I`,ticks:313,entryTick:17,exitTick:307,fastest:290,gigue:[915,485,310],raccord:1e3,exigence:4}},{grid:`133b602c`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgCCBH5IjQISlgFaJMUBIk7qBw`,ticks:318,entryTick:0,exitTick:311,fastest:306,gigue:[985,735,325],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgSSA8YBSBSlAUG0AUL1ASJG8gc`,ticks:311,entryTick:17,exitTick:304,fastest:283,gigue:[815,555,365],raccord:1e3,exigence:4}},{grid:`88183dd0`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwDKBSCNAhGeARo2XXYaJGa6Bw`,ticks:319,entryTick:0,exitTick:312,fastest:312,gigue:[970,590,260],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwSKA84BSDSFATn8AQo2TVRKvgd6`,ticks:312,entryTick:17,exitTick:305,fastest:283,gigue:[780,320,145],raccord:1e3,exigence:5}}]},cheminee:{variants:[{grid:`db52e97e`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAAggXeARJeCj4IPEUKfgh8Cj5E4gY`,ticks:300,entryTick:0,exitTick:293,fastest:293,gigue:[1e3,740,535],raccord:null,exigence:3},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAEygTGAQq-AQh8Cn4IfAg8xgZq`,ticks:294,entryTick:17,exitTick:287,fastest:266,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`e371ab0b`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEAigW-ASruAQgshQEJPYYBCjaNAQlFigg`,ticks:346,entryTick:0,exitTick:339,fastest:339,gigue:[1e3,965,730],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEE2gaWARptDkUingEoZRZZlgGaBw`,ticks:336,entryTick:17,exitTick:329,fastest:313,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`eb50c33a`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIA-gTmARJWCsYBEi5VPAldZmo-ZQl9xgdC`,ticks:368,entryTick:0,exitTick:361,fastest:358,gigue:[925,650,400],raccord:null,exigence:3},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIEqgY4jQEKngESxQEKPGYoXRZVEjZsqgc`,ticks:357,entryTick:17,exitTick:351,fastest:330,gigue:[955,550,340],raccord:1e3,exigence:4}}]},"demi-tour":{variants:[{grid:`e8183237`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowANIBhgHKAma6AlD9AQghxghK`,ticks:325,entryTick:0,exitTick:319,fastest:319,gigue:[1e3,995,840],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowBPoBdsoDRA0cvQEJJZ4IUg`,ticks:283,entryTick:17,exitTick:276,fastest:259,gigue:[990,795,655],raccord:1e3,exigence:2}},{grid:`8ca914f4`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxAIIBpgUSlgE6tgGqAZYBqgk`,ticks:337,entryTick:0,exitTick:330,fastest:330,gigue:[655,515,295],raccord:null,exigence:5},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxBOoBZuoDVBUMvQEJDY4JSg`,ticks:294,entryTick:17,exitTick:287,fastest:270,gigue:[795,670,415],raccord:1e3,exigence:3}},{grid:`9caa3e3a`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyAKoCGDIuLIYBigGeAYIFCBLeAYIJ`,ticks:362,entryTick:0,exitTick:355,fastest:361,gigue:[1e3,995,830],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyBJoBrgMq1gUS7gpC`,ticks:350,entryTick:17,exitTick:343,fastest:326,gigue:[1e3,990,915],raccord:1e3,exigence:1}}]},descente:{variants:[{grid:`4a1cf642`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAAwgEmug8`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAEigEm4gYmmgg`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`42a79a95`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEAyhQ`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEE6gwm8gY`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a7c9ce96`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIAshs`,ticks:438,entryTick:0,exitTick:432,fastest:432,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIE4ho`,ticks:428,entryTick:17,exitTick:421,fastest:404,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"escalier-friable":{variants:[{grid:`01658677`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MADyAV6yAk7SAY4BsgKGAboChgVy`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[895,455,290],raccord:null,exigence:4},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MASSAWaqAn7yAk6aAl6iAWFmNMYEQg`,ticks:313,entryTick:17,exitTick:306,fastest:284,gigue:[1e3,705,365],raccord:1e3,exigence:3}},{grid:`1be7cff6`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQCqAXayAo4BygKOAfICtgQypgVC`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,870,715],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQSSAV66An7CAoYBygK-BDKmBVI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,935,725],raccord:1e3,exigence:2}}]},escalier:{variants:[{grid:`05af6705`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAA6gHWA0KODEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAEigHuAyqeDEI`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`9878e86d`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEAmgFOogJOsgJeqgLuCkI`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,715,415],raccord:null,exigence:3},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEEigFG-gFmqgJmigLeCko`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[855,605,345],raccord:1e3,exigence:3}},{grid:`11583b6c`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIAygFeogKWAYIDXqoC1gti`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,1e3,900],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIEkgFWygJ2ggNmogLWC0I`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,965,815],raccord:1e3,exigence:2}}]},"grande-scie":{variants:[{grid:`a02e1fa2`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAAwggO-gk`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,985,870],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAEogM-ggMOkgs`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,955,910],raccord:1e3,exigence:1}},{grid:`49bd71df`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEA8gFW0gImygIOmgs`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[875,795,625],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEE6gMesgMOkgs`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,895,825],raccord:1e3,exigence:2}},{grid:`9d0ae4d0`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIAyggWmgs`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[870,760,540],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIE-gcWmgs`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[890,475,380],raccord:1e3,exigence:4}}]},"iles-friables":{variants:[{grid:`9a92157b`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MACiAX6CA5YB-gJ2sgPWBWI`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MASKAWb6An6iA1ayA54BkgU`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,930],raccord:1e3,exigence:1}},{grid:`6a773f5b`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQDKAY4BggOmAaIDtgGiA36CA2byAw`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,935,820],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQSKAdYFKj7KAl76Anb6Am6yBA`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,905,610],raccord:1e3,exigence:2}}]},lucarne:{variants:[{grid:`c7845775`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MADCATaCA5YBogI24gOmCFI`,ticks:340,entryTick:0,exitTick:333,fastest:332,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MATKAoYEQIYBggSGCEI`,ticks:329,entryTick:17,exitTick:322,fastest:303,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`9e699e95`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQDKAS7CA26qBoYIYg`,ticks:340,entryTick:0,exitTick:333,fastest:331,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQTKAsYECi7iA9YIUg`,ticks:327,entryTick:17,exitTick:320,fastest:303,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"mur-friable":{variants:[{grid:`396b4611`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAAwgWWARoeRCUKXgo-ISWGB0o`,ticks:273,entryTick:0,exitTick:266,fastest:266,gigue:[1e3,775,765],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAEigOWASjOAQgcVQpWCjZUCS1O8gY`,ticks:264,entryTick:17,exitTick:257,fastest:238,gigue:[1e3,960,790],raccord:1e3,exigence:2}},{grid:`57630af1`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEA0gVkCl41CS0-CCRlCS00CS00tgZq`,ticks:289,entryTick:0,exitTick:282,fastest:282,gigue:[970,805,545],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEEggPOASBeCoYBCHwKfgh8CDzGBmo`,ticks:278,entryTick:17,exitTick:271,fastest:252,gigue:[1e3,695,460],raccord:1e3,exigence:3}},{grid:`b9419651`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIAygWGAQoWXQpeCiZVCmYKNlQIjAH6Bg`,ticks:305,entryTick:0,exitTick:298,fastest:295,gigue:[1e3,985,695],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIEigPWARhWCi4IVEUKfgh8Cl4KHkUK_gZq`,ticks:294,entryTick:17,exitTick:287,fastest:267,gigue:[1e3,1e3,810],raccord:1e3,exigence:2}}]},"mur-seul":{variants:[{grid:`7fb29d5b`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAAaibKATCiAeYBIsYHWg`,ticks:231,entryTick:0,exitTick:224,fastest:224,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAEygLWAjLGB1I`,ticks:219,entryTick:17,exitTick:213,fastest:196,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0a9387cb`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEAYkbCASCiAeYBIoYDIuYHQg`,ticks:284,entryTick:0,exitTick:277,fastest:277,gigue:[1e3,995,930],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEE6gLGAgq-AwreBzo`,ticks:272,entryTick:17,exitTick:266,fastest:249,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`3a0f72fb`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIAogSGAhKOAyKeAxieAfoG`,ticks:339,entryTick:0,exitTick:333,fastest:334,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIE6gLeAgqOAxqmAwqOAZoH`,ticks:326,entryTick:17,exitTick:319,fastest:302,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},"petits-trous":{variants:[{grid:`78610c6e`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowAPIBRroFHrIFXpoH`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowBIoBRpIFPsoFXqIH`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,870],raccord:1e3,exigence:2}},{grid:`b45c8bda`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxAKoCVtIFRqIGTroH`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,920],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxBPoBRroFRqIGTroH`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,900],raccord:1e3,exigence:1}},{grid:`cf4d6771`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyAIIDVpIGVvoGVroH`,ticks:406,entryTick:0,exitTick:399,fastest:399,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyBKICXqIGTqIHNqoH`,ticks:395,entryTick:17,exitTick:388,fastest:371,gigue:[1e3,970,870],raccord:1e3,exigence:2}}]},piliers:{variants:[{grid:`aadaf7dd`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MACSBK4BmgMO8gN-sgY`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MASKAYYBggTOAeoDlgHaBg`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,995,930],raccord:1e3,exigence:1}},{grid:`da04bc37`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQDSAy6qA06yAi7CA0bKAj7qBQ`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,950,745],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQSSAZYB0gNu-gI2ugM-sgI--gU`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,885,655],raccord:1e3,exigence:2}}]},"plafond-pics":{variants:[{grid:`8e06364a`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowANIGPqIDDooDPuII`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,775],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowBPIFLrIDFsoDNqoI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`caa1e0fd`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxANIGPsIEPtoDPsoI`,ticks:395,entryTick:0,exitTick:388,fastest:388,gigue:[1e3,1e3,625],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxBPIFPqoENvoDPtII`,ticks:384,entryTick:17,exitTick:377,fastest:360,gigue:[1e3,1e3,830],raccord:1e3,exigence:2}},{grid:`ea0df3f0`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyANoGPvoEPvIERuoI`,ticks:427,entryTick:0,exitTick:421,fastest:421,gigue:[1e3,955,630],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyBIIGPooFPvIERuII`,ticks:417,entryTick:17,exitTick:410,fastest:393,gigue:[1e3,970,635],raccord:1e3,exigence:2}}]},plaine:{variants:[{grid:`c382a490`,arret:{code:`AQMPbW9kdWxlOnBsYWluZTowAJIKRsoI`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZTowBNoJRrII`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`754fdb4d`,arret:{code:`AQMPbW9kdWxlOnBsYWluZToxALIOPsII`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZToxBNoNNsoI`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,925],raccord:1e3,exigence:1}},{grid:`cd270781`,arret:{code:`AQMPbW9kdWxlOnBsYWluZToyAKoSRsoI`,ticks:438,entryTick:0,exitTick:432,fastest:432,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZToyBOIRNtII`,ticks:428,entryTick:17,exitTick:421,fastest:404,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},"pont-friable":{variants:[{grid:`abf03c43`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowAMIS`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowBPIR`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`617f39ef`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxAKIV`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxBNIU`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`19ffa436`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyAIIY`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyBKoX`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},puits:{variants:[{grid:`f5d8f48c`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjAAQoYDQIEBQEGaCg`,ticks:259,entryTick:0,exitTick:252,fastest:252,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjAEigEmIEEiYCJkpQHCASHGCFI`,ticks:259,entryTick:17,exitTick:252,fastest:235,gigue:[780,715,665],raccord:1e3,exigence:2}},{grid:`9bef2b96`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjEAQoYDQIEBwAGCAkCaCA`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjEEygNAwQGAAvoJ`,ticks:280,entryTick:17,exitTick:273,fastest:251,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`5ab12bb6`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjIAMpYBkgIwQWDBATCSATDSCQ`,ticks:292,entryTick:0,exitTick:285,fastest:285,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjIEygTBAkDCAUH6CA`,ticks:296,entryTick:17,exitTick:289,fastest:269,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},quinconce:{variants:[{grid:`297fb7fe`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowAJIFVvIEVuoDVoIJ`,ticks:395,entryTick:0,exitTick:388,fastest:388,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowBLoEZuIEXuoDRooJ`,ticks:384,entryTick:17,exitTick:377,fastest:360,gigue:[1e3,1e3,875],raccord:1e3,exigence:2}},{grid:`f8e884bd`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxAJIFhgHyBX66BF6CCg`,ticks:449,entryTick:0,exitTick:442,fastest:442,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxBMIEfvIFfvIEVtoJ`,ticks:439,entryTick:17,exitTick:432,fastest:415,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-mur":{variants:[{grid:`26c5b77b`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAA4gFGmgw`,ticks:231,entryTick:0,exitTick:224,fastest:224,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAEigGGAdoL`,ticks:220,entryTick:17,exitTick:213,fastest:196,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`a770fa59`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEA4gFG8gw`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEEigGGAbIM`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]},"ressort-plafond":{variants:[{grid:`f814b32e`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowAOIBRvoO`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowBIoBhgG6Dg`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`156dde60`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxAJIBlhBS`,ticks:286,entryTick:0,exitTick:279,fastest:279,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxBIoBjgGKDw`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[1e3,1e3,890],raccord:1e3,exigence:2}},{grid:`75d76838`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyAPoB7gQq_gIKPkyCCw`,ticks:353,entryTick:0,exitTick:346,fastest:351,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyBIoB5gUitgISfhkWygk`,ticks:326,entryTick:17,exitTick:320,fastest:304,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}}]},"ressorts-trous":{variants:[{grid:`ade9e5f0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAA4gMm6ho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAE6gMmiho`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`18086399`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEA-gQe4hs`,ticks:526,entryTick:0,exitTick:519,fastest:519,gigue:[600,510,390],raccord:null,exigence:5},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEEwgQWyhs`,ticks:515,entryTick:17,exitTick:508,fastest:491,gigue:[600,555,445],raccord:1e3,exigence:5}}]},"saut-long":{variants:[{grid:`07b9bc37`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowAOoHNooN`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowBJoHLpIN`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,845],raccord:1e3,exigence:2}},{grid:`21674248`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxAOoHXroN`,ticks:351,entryTick:0,exitTick:344,fastest:344,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxBJIHXroN`,ticks:340,entryTick:17,exitTick:334,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`94275b98`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyAOoHfvIN`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyBJIHhgHqDQ`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-ronde":{variants:[{grid:`ff331a84`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MACKCY4KYg`,ticks:318,entryTick:0,exitTick:311,fastest:309,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MAS6CJ4KUg`,ticks:308,entryTick:17,exitTick:301,fastest:281,gigue:[1e3,1e3,860],raccord:1e3,exigence:2}},{grid:`2b1ac065`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQCCCKYLUg`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQTCB44LWg`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ed7594bd`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgDCBDViYDGGAwouigo`,ticks:323,entryTick:0,exitTick:316,fastest:316,gigue:[980,785,665],raccord:null,exigence:2},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgSSBkC6AiaiCg`,ticks:313,entryTick:17,exitTick:306,fastest:289,gigue:[915,800,720],raccord:1e3,exigence:2}}]},"scie-sol":{variants:[{grid:`ee21fb0a`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAAsgamBTLWAgpesgQ`,ticks:316,entryTick:0,exitTick:309,fastest:309,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAE0gWeBCq-CFo`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0c973bea`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEAwgXmAyreCVI`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEE8gTmAyLeCVo`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}},{grid:`f78c9cda`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIA0gSOBDrOAirWAgpesgQ`,ticks:316,entryTick:0,exitTick:309,fastest:309,gigue:[1e3,1e3,860],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIE-gO-BCLeAiKGB1o`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},tunnel:{variants:[{grid:`34535cbd`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDowAIIOJuoE`,ticks:305,entryTick:0,exitTick:298,fastest:298,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDowBOoLZoIBZpIE`,ticks:295,entryTick:17,exitTick:288,fastest:271,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6dc2250a`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoxAMIQZoIBRroE`,ticks:371,entryTick:0,exitTick:364,fastest:364,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoxBOoPZoIBRroE`,ticks:360,entryTick:17,exitTick:353,fastest:336,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`5abb35fc`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoyAMIWRqIE`,ticks:436,entryTick:0,exitTick:429,fastest:429,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoyBMoVJuoE`,ticks:426,entryTick:17,exitTick:419,fastest:402,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]}}},Qe=[`mural`,`precision`,`vertical`,`scie`,`friable`,`ressort`,`respiration`],$e=[`arret`,`elan`],Y=class extends Error{constructor(e){super(e),this.name=`ModuleError`}},et=new Set([`id`,`intention`,`etiquettes`,`format`,`paliers`,`repeter`,`variante`]),tt=/^[#.^v<>oOx*]+$/;function nt(e){let t=e.replace(/\r/g,``).split(`
`),n=0,r={};for(;n<t.length;n++){let e=t[n].trim();if(e===``||e.startsWith(`//`))continue;if(e===`grille:`)break;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(!i||!et.has(i[1]))throw new Y(`Ligne ${n+1} : « clé: valeur » attendu (${[...et].join(`, `)}, puis « grille: »)`);(r[i[1]]??=[]).push(i[2].trim())}if(n>=t.length)throw new Y(`« grille: » manquant`);let i=e=>{let t=r[e];if(!t||t.length!==1||t[0]===``)throw new Y(`« ${e}: » attendu une fois`);return t[0]},a=i(`id`);if(!/^[a-z0-9-]{1,24}$/.test(a))throw new Y(`id « ${a} » invalide (minuscules, chiffres, tirets, 24 au plus)`);let o=e=>`Morceau « ${a} » : ${e}`,s=i(`intention`),c=i(`etiquettes`).split(/\s+/);for(let e of c)if(!Qe.includes(e))throw new Y(o(`étiquette « ${e} » inconnue (${Qe.join(`, `)})`));if(new Set(c).size!==c.length)throw new Y(o(`étiquette en double`));if(i(`format`)!==`2`)throw new Y(o(`format ${i(`format`)} : seul le format 2 (paliers posés, lot 6) est lu`));let l=/^(\d+)\s+(\d+)$/.exec(i(`paliers`));if(!l)throw new Y(o(`« paliers: <rangée du sol à l'entrée> <rangée du sol à la sortie> » attendu`));n++;let u=[];for(;n<t.length&&t[n].trim()!==``;n++)u.push(t[n].trim());let d=t.slice(n).map(e=>e.trim()).filter(e=>e!==``&&!e.startsWith(`//`));if(u.length===0)throw new Y(o(`grille vide`));let f=u[0].length;u.forEach((e,t)=>{if(e.length!==f)throw new Y(o(`rangée ${t} : ${e.length} colonnes au lieu de ${f}`));if(!tt.test(e))throw new Y(o(`rangée ${t} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`))});let p=Number(l[1]),m=Number(l[2]);if(p>=u.length||m>=u.length)throw new Y(o(`rangée de palier hors de la grille`));if(p<4||m<4)throw new Y(o(`rangée de palier sous la 4e : moins de 4 rangées libres au-dessus`));let h=[],g=(r.repeter??[]).map(e=>{let t=/^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(e);if(!t)throw new Y(o(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${e} »)`));let n={param:t[1],axis:t[2],from:Number(t[3]),to:Number(t[4])},r=n.axis===`colonnes`?f:u.length;if(n.from>n.to||n.to>=r)throw new Y(o(`plage ${n.from}-${n.to} hors du gabarit`));return h.includes(n.param)||h.push(n.param),n});for(let e of g)for(let t of g)if(e!==t&&e.axis===t.axis&&e.from<=t.to&&t.from<=e.to)throw new Y(o(`les plages ${e.from}-${e.to} et ${t.from}-${t.to} se chevauchent`));for(let e of d)for(let t of e.matchAll(/\{([a-z][a-z0-9]*)\}/g))h.includes(t[1])||h.push(t[1]);for(let e of[p,m])if(g.some(t=>t.axis===`rangees`&&e>=t.from&&e<=t.to))throw new Y(o(`une rangée de palier ne se répète pas`));let _=(r.variante??[]).map((e,t)=>{let n={};for(let r of e.split(/\s+/).filter(Boolean)){let e=/^([a-z][a-z0-9]*)=(\d+)$/.exec(r);if(!e)throw new Y(o(`variante ${t} : « nom=valeur » attendu (« ${r} »)`));if(!h.includes(e[1]))throw new Y(o(`variante ${t} : paramètre « ${e[1]} » inconnu`));let i=Number(e[2]),a=g.some(t=>t.param===e[1])?40:v;if(i>a)throw new Y(o(`variante ${t} : ${e[1]} = ${i} (au plus ${a})`));n[e[1]]=i}for(let e of h)if(n[e]===void 0)throw new Y(o(`variante ${t} : « ${e} » manque`));return n});if(_.length===0)throw new Y(o(`au moins une « variante: » (même sans paramètre)`));return{id:a,intention:s,tags:c,entryRow:p,exitRow:m,repeats:g,params:h,variants:_,grid:u,annex:d,text:e}}function rt(e,t,n){let r=[],i=Array(e).fill(-1),a=Array(e).fill(-1);for(let o=0;o<e;){let e=t.find(e=>e.from===o),s=e?e.to:o,c=e?n[e.param]:1;for(let e=0;e<c;e++)for(let t=o;t<=s;t++)e===0&&(i[t]=r.length),a[t]=r.length,r.push(t);o=s+1}return{src:r,first:i,last:a}}function it(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t.toString(16).padStart(8,`0`)}var at=(e,t)=>e<t?`.`:`#`;function ot(e,t,n={}){let r=e.variants[t];if(!r)throw new Y(`Morceau « ${e.id} » : pas de variante ${t} (0 à ${e.variants.length-1})`);let i=n.lancement??0;if(!Number.isInteger(i)||i<0||i>40)throw new Y(`lancement : de 0 à 40 colonnes`);let a=n=>`Morceau « ${e.id} », variante ${t} : ${n}`,o=rt(e.grid[0].length,e.repeats.filter(e=>e.axis===`colonnes`),r),s=rt(e.grid.length,e.repeats.filter(e=>e.axis===`rangees`),r),c=o.src.length,l=s.src.length;if(l>30)throw new Y(a(`${l} rangées (au plus 30)`));if(c<1)throw new Y(a(`grille vide`));let u=s.first[e.entryRow],d=s.first[e.exitRow],f=i+1+2,p=f+c+2,m=i>0?0:1,h=s.src.map(t=>o.src.map(n=>e.grid[t][n]).join(``)).map((e,t)=>{let n=at(t,u).repeat(f),r=t===u-1?n.slice(0,m)+`S`+n.slice(m+1):n,i=at(t,d).repeat(3)+(t===d-1?`F`:at(t,d));return r+e+i}),g=[`section ${e.id} ${f}-${f+c-1}`];for(let t of e.annex){let e=t.replace(/\{([a-z][a-z0-9]*)\}/g,(e,t)=>String(r[t])).split(/\s+/);if(e[0]!==`scie`)throw new Y(a(`bloc annexe : seules les scies sont permises (« ${e[0]} »)`));g.push(e.map((e,t)=>{let n=t>=5?/^(\d+)('?),(\d+)('?)$/.exec(e):null;if(!n)return e;let r=Number(n[1]),i=Number(n[3]),c=(n[2]?o.last:o.first)[r],l=(n[4]?s.last:s.first)[i];if(c===void 0||l===void 0||c<0||l<0)throw new Y(a(`point ${e} hors de la grille ou retiré par la variante`));return`${c+f},${l}`}).join(` `))}let _=h.join(`
`)+`

`+g.join(`
`)+`
`,v;try{v=O(_)}catch(e){throw e instanceof S?new Y(a(e.message)):e}let y={id:e.id,variant:t,values:r,levelId:`module:${e.id}:${t}`,level:v,ascii:_,hash:it(_),lead:f,width:c,height:l,entryRow:u,exitRow:d,palierIn:{col0:f-2,col1:f-1,row:u},palierOut:{col0:f+c,col1:f+c+2-1,row:d},exitCol:p},b=st(y);if(b.length>0)throw new Y(a(b.join(` ; `)));return y}function st(e){let t=[],n=e.level,r=p,i=(e,t)=>n.tiles[t*n.width+e];for(let[a,o]of[[`entrée`,e.palierIn],[`sortie`,e.palierOut]]){o.row<4&&t.push(`palier d'${a} : moins de 4 rangées au-dessus`);for(let e=o.col0;e<=o.col1;e++)for(let r=0;r<n.height;r++){let n=r<o.row?0:1;i(e,r)!==n&&t.push(`palier d'${a} : tuile (${e}, ${r}) ${n===1?`vide`:`occupée`}`)}let e={x:o.col0*r,y:(o.row-4)*r,w:(o.col1-o.col0+1)*r,h:4*r};for(let r of n.saws){let n=r.cycle===0?1:r.cycle;for(let i=0;i<n;i++){let n=j(r,i);if(he(n.x,n.y,r.radius,e)){t.push(`palier d'${a} : la scie ${r.id} y passe`);break}}}}return h(i(e.lead,e.entryRow-1))&&t.push(`première colonne du morceau pleine au ras du sol : on n'y entre pas en courant`),t}var ct=Xe.map(nt);function lt(e){let t=ct.find(t=>t.id===e);if(!t)throw new Y(`Morceau « ${e} » inconnu`);return t}function ut(e,t,n={}){return ot(lt(e),t,n)}Array.from({length:25},(e,t)=>7+15*t);function dt(e){return M(e.x+m(N,2))}function ft(e){return e.ground===1&&e.vx===I.runSpeed&&e.vy===0&&e.air===0&&e.wallSide===0&&e.wallAir===255&&e.slide===0&&e.buffer===0&&e.held===0&&e.jumping===0&&e.lock===0&&e.lockDir===0}function pt(e,t){return Ze.jumpSimVersion===3?Ze.modules[e]?.variants[t]??null:null}function mt(e){return!e||!e.arret||!e.elan||e.arret.exigence===0||e.elan.exigence===0?0:Math.max(e.arret.exigence,e.elan.exigence)}var ht=n(2026,10,16);function gt(e){return e-ht+1}function _t(e){return`jour-${a(e)}-g2`}var vt=3e3,yt=4800,bt=3600,X=3360,xt=3840,St=360,Ct=1785689458,wt={gold:110,silver:130,bronze:160},Tt=`repos4310:`;function Et(e){return Number.parseInt(it(`${Tt}${e}`),16)%3}function Dt(e,t){return Et(e)===(t%3+3)%3}var Z=(e,t)=>m(e*t+99,100);function Ot(e){return{author:e,gold:Z(e,wt.gold),silver:Z(e,wt.silver),bronze:Z(e,wt.bronze)}}function kt(e,t){return e<=t.author?`author`:e<=t.gold?`gold`:e<=t.silver?`silver`:e<=t.bronze?`bronze`:null}var At=null;function jt(){return At||(At=ct.map(e=>e.variants.flatMap((t,n)=>{let r=pt(e.id,n),i=mt(r);if(!r?.arret||!r.elan||i<1)return[];let a=ut(e.id,n),o=e=>e.exitTick-e.entryTick;return[{id:e.id,variant:n,tags:e.tags,exigence:i,arret:o(r.arret),elan:o(r.elan),height:a.height,width:a.width,entryRow:a.entryRow,exitRow:a.exitRow}]})).filter(e=>e.length>0),At)}var Q=(e,t)=>e.tags.includes(t),Mt=e=>e.entry===`arret`?e.choice.arret:e.choice.elan;function Nt(e){let t=[],n=0;e.forEach((r,i)=>{i>0&&(n=t[i-1]+e[i-1].choice.exitRow-r.choice.entryRow),t.push(n)});let r=0,i=0;return e.forEach((e,n)=>{(n===0||t[n]<r)&&(r=t[n]),(n===0||t[n]+e.choice.height>i)&&(i=t[n]+e.choice.height)}),{tops:t.map(e=>e-r+1),height:i-r+1}}var $=(e,t)=>m(e*1e3,t);function Pt(e,t){let n=jt().filter(t=>!Dt(t[0].id,e)),r=[],i=new Set,a=0;for(;;){if(r.length>=13)return`trop de morceaux`;let e=r.length===0?`arret`:`elan`,o=$(a,bt),s=130+m(200*(o<1e3?o:1e3),1e3),c=r.length>=2&&r.slice(-2).every(e=>Q(e.choice,`precision`)),l=!r.some(e=>Q(e.choice,`mural`)),u=!r.some(e=>Q(e.choice,`scie`)),d=!r.some(e=>Q(e.choice,`respiration`)),f=!r.some(e=>e.choice.exigence>=4),p=(e,t)=>{let n=a+m(t,2);return n>=m(xt*350,1e3)&&n<=m(X*650,1e3)&&Q(e,`respiration`)},h=d&&a+St>m(X*650,1e3),g=l&&o>=550,_=u&&o>=550,v=f&&o>=667,y=[];for(let o of n){let n=o[0].id;if(i.has(n))continue;let f=o[0].tags;if(c&&f.includes(`precision`)||f.includes(`respiration`)&&!d||h&&!f.includes(`respiration`)||(g||_)&&!(g&&f.includes(`mural`)||_&&f.includes(`scie`)))continue;let m=o.filter(t=>{let n={choice:t,entry:e},i=Mt(n)+0;if(Q(t,`respiration`)&&!p(t,i)||v&&t.exigence<4)return!1;let o=a+i;if(o>xt)return!1;if(o>=X){let e=[...r.map(e=>e.choice),t];if(!e.some(e=>Q(e,`mural`))||!e.some(e=>Q(e,`scie`))||!e.some(e=>Q(e,`respiration`))||!e.some(e=>e.exigence>=4)||e.length<6)return!1}return Nt([...r,n]).height<=56});if(m.length===0)continue;let b=[],x=1/0;for(let e of m){let t=Math.abs(e.exigence*100-s);t<x?(x=t,b=[e]):t===x&&b.push(e)}let S=b.length===1?b[0]:t.pick(b),C=x<=50?8:x<=100?5:x<=200?2:1;(l&&Q(S,`mural`)||u&&Q(S,`scie`))&&(C*=2),y.push({pick:{choice:S,entry:e},weight:C})}if(y.length===0)return`impasse au morceau ${r.length+1}`;let b=0;for(let e of y)b+=e.weight;let x=t.int(b),S=y[0];for(let e of y){if(x<e.weight){S=e;break}x-=e.weight}if(r.push(S.pick),i.add(S.pick.choice.id),a+=Mt(S.pick)+(r.length,0),a>=X)return r}}function Ft(e){let t=jt().flat(),n=e.map((e,n)=>{let r=t.find(t=>t.id===e.id&&t.variant===e.variant);if(!r)throw RangeError(`Morceau « ${e.id} », variante ${e.variant} : pas de solution utilisable`);return{choice:r,entry:n===0?`arret`:`elan`}});if(n.length===0)throw RangeError(`Assemblage vide`);let{tops:r,height:i}=Nt(n),a=1+n.reduce((e,t)=>e+t.choice.width,0)+(n.length+1)*2+1,o=[];for(let e=0;e<i;e++)o.push(Array(a).fill(`#`));let s=[],c=[],l=[],u=3;n.forEach((e,t)=>{let n=ut(e.choice.id,e.choice.variant),[a,l=``]=n.ascii.split(`

`),d=a.split(`
`).map(e=>e.slice(n.lead,n.lead+n.width)),f=r[t];for(let e=0;e<d.length;e++)for(let t=0;t<n.width;t++)o[f+e][u+t]=d[e][t];let p=d[d.length-1];for(let e=0;e<n.width;e++)if(p[e]!==`#`)for(let t=f+d.length;t<i;t++)o[t][u+e]=`.`;s.push(`section ${e.choice.id} ${u}-${u+n.width-1}`);for(let t of l.split(`
`)){let r=t.trim().split(/\s+/);r[0]===`scie`&&s.push(r.map((t,r)=>{if(r===1)return`${e.choice.id}/${t}`;let i=r>=5?/^(\d+),(\d+)$/.exec(t):null;return i?`${Number(i[1])-n.lead+u},${Number(i[2])+f}`:t}).join(` `))}c.push({id:e.choice.id,variant:e.choice.variant,entry:e.entry,tags:e.choice.tags,exigence:e.choice.exigence,solutionTicks:Mt(e),col0:u,col1:u+n.width-1,top:f,entryRow:f+n.entryRow,exitRow:f+n.exitRow,start:0,end:0}),u+=n.width+2});for(let e=0;e<=n.length;e++){let t=c[e-1],r=c[e],a=r?r.entryRow:t.exitRow,s=Math.min(t?t.top:i,r?r.top:i),u=r?r.col0-2:t.col1+1,d=e===0?u-1:u,f=e===n.length?u+2+1:u+2;for(let e=d;e<f;e++)for(let t=s;t<a;t++)o[t][e]=`.`;l.push({col0:u,col1:u+2-1,row:a}),o[a-1][u]=e===0?`S`:e===n.length?`.`:`C`,e===n.length&&(o[a-1][u+2]=`F`)}let d=o.map(e=>e.join(``)).join(`
`)+`

`+s.join(`
`)+`
`;return{level:O(d),ascii:d,pieces:c,paliers:l}}function It(e){let t=e.level,n=(e,n)=>U(e,n,t,I),r=[],i=[],a=V(t);for(let t=0;t<e.pieces.length;t++){let o=e.pieces[t],s=pt(o.id,o.variant)?.[o.entry];if(!s)return`${o.id}:${o.variant} sans solution`;let c=Fe(Re(s.code).runs),l=t===e.pieces.length-1,u=l?-1:e.pieces[t+1].col0;i.push(r.length);let d=!1,f=c.length+64;for(let e=t===0?0:s.entryTick;e<f&&!d;e++){let i=e<c.length?c[e]:2;if(a=n(a,i),r.push(i),a.status===2)return`${o.id}:${o.variant} meurt (morceau ${t+1})`;if(a.status===3){if(!l)return`${o.id}:${o.variant} touche l'arrivée (morceau ${t+1})`;d=!0}else if(!l&&dt(a.player)>=u){if(!ft(a.player))return`${o.id}:${o.variant} sort hors de la course propre (morceau ${t+1})`;d=!0}}if(!d)return`${o.id}:${o.variant} n'aboutit pas (morceau ${t+1})`}return{inputs:r,starts:i}}function Lt(e,t){let n=0,r=[[0,0],[0,0],[0,0]];for(let i of e){n+=i.exigence;let e=m(i.start+i.end,2),a=e*3<t?0:e*3<t*2?1:2;r[a][0]+=i.exigence*(i.end-i.start),r[a][1]+=i.end-i.start}let i=e=>e[1]===0?0:m(e[0]*10,e[1]);return{sum:n,rate:t>0?m(n*10*60*120,t):0,thirds:[i(r[0]),i(r[1]),i(r[2])]}}function Rt(e){let t=[],{pieces:n,authorTicks:r}=e;(r<vt||r>yt)&&t.push(`temps de l'auteur ${r} pas hors de [${vt}, ${yt}]`),(n.length<6||n.length>13)&&t.push(`${n.length} morceaux (de 6 à 13)`),e.level.height>56&&t.push(`hauteur ${e.level.height} (au plus 56)`),new Set(n.map(e=>e.id)).size!==n.length&&t.push(`morceau en double`),n.some(e=>e.tags.includes(`mural`))||t.push(`aucun morceau mural`),n.some(e=>e.tags.includes(`scie`))||t.push(`aucun morceau scie`);let i=0;for(let e of n)i=e.tags.includes(`precision`)?i+1:0,i>2&&t.push(`plus de 2 morceaux precision d'affilée`);let a=n.filter(e=>e.tags.includes(`respiration`));a.length!==1&&t.push(`${a.length} morceaux respiration (un seul, au milieu)`);for(let e of a){let n=$(e.start+e.end,2*r);(n<350||n>650)&&t.push(`respiration à ${n} ‰ (entre 350 et 650)`)}(n[0]?.entry!==`arret`||n.slice(1).some(e=>e.entry!==`elan`))&&t.push(`entrées : le premier à l'arrêt, les autres en élan`),n.some(e=>e.exigence>=4)||t.push(`aucun morceau d'exigence 4 ou plus`);let o=e.exigence;(o.rate<430||o.rate>520)&&t.push(`exigence ${o.rate} hors de [430, 520]`),o.thirds[2]<o.thirds[0]&&t.push(`le dernier tiers (${o.thirds[2]}) est moins exigeant que le premier (${o.thirds[0]})`);let s=e.palierTicks.reduce((e,t)=>e+t,0);return s*1e3>=60*r&&t.push(`course à vide sur les paliers ${$(s,r)} ‰ (moins de 60 ‰)`),t}function zt(e,t,n){let r=t.slice(1,-1),i=r.map(()=>0),a=V(e);for(let t of n){if(a=U(a,t,e,I),a.status===2)break;if(a.player.ground===1&&!(t&4)){let e=dt(a.player);for(let t=0;t<r.length;t++)e>=r[t].col0&&e<=r[t].col1&&i[t]++}if(a.status===3)break}return i}function Bt(e,t){return $(Math.abs(e-bt),bt)+$(Math.abs(t-475),475)}function Vt(e,t){let n;try{n=Ft(e)}catch(e){return`assemblage : ${e.message}`}let r=It(n);if(typeof r==`string`)return r;let i={simVersion:3,levelId:t,start:{checkpoint:-1,held:0,time:0,sections:[],elan:0},runs:Pe(r.inputs)},a=He(n.level,i,t);if(!a.finished)return`le rejeu n'arrive pas`;if(a.deaths.length>0)return`le rejeu meurt ${a.deaths.length} fois`;let o=a.time,s=n.pieces.map((e,t)=>({...e,start:r.starts[t],end:t+1<n.pieces.length?r.starts[t+1]:o})),c={id:t,level:n.level,ascii:n.ascii,hash:it(n.ascii),pieces:s,paliers:n.paliers,palierTicks:zt(n.level,n.paliers,r.inputs),replay:i,code:Le(i),authorTicks:o,medals:Ot(o),exigence:Lt(s,o)};return{built:c,problems:Rt(c)}}var Ht=[{id:`ressorts-trous`,variant:0},{id:`ascenseur`,variant:1},{id:`mur-friable`,variant:2},{id:`ressort-plafond`,variant:1},{id:`pont-friable`,variant:2},{id:`grande-scie`,variant:0},{id:`escalier`,variant:2},{id:`scie-sol`,variant:2},{id:`cheminee-pics`,variant:2},{id:`lucarne`,variant:0},{id:`puits`,variant:0},{id:`cheminee`,variant:0}],Ut=new Map;function Wt(n){let r=Ut.get(n);if(r)return r;let i=_t(n),o=t(n,Ct),s=[],c=null;for(let r=0;r<40&&!(r>=6&&c);r++){let a=Pt(n,new e(t(o,r)));if(typeof a==`string`){s.push({index:r,status:`impasse`,reason:a,pieces:[],ticks:0,rate:0,score:0});continue}let l=a.map(e=>`${e.choice.id}:${e.choice.variant}`),u=Vt(a.map(e=>({id:e.choice.id,variant:e.choice.variant})),i);if(typeof u==`string`){s.push({index:r,status:`refusé`,reason:u,pieces:l,ticks:0,rate:0,score:0});continue}let{built:d,problems:f}=u,p=Bt(d.authorTicks,d.exigence.rate),m=f.length>0?`refusé`:`valide`;s.push({index:r,status:m,reason:f.join(` ; `),pieces:l,ticks:d.authorTicks,rate:d.exigence.rate,score:p}),!(f.length>0)&&(!c||p<c.score)&&(c={built:d,index:r,score:p})}let l;if(c)l={...c.built,day:n,date:a(n),number:gt(n),attempts:s,chosen:c.index,fallback:!1};else{let e=Vt(Ht,i);if(typeof e==`string`||e.problems.length>0)throw Error(`Niveau de secours invalide : ${typeof e==`string`?e:e.problems.join(` ; `)}`);l={...e.built,day:n,date:a(n),number:gt(n),attempts:s,chosen:-1,fallback:!0}}return Ut.set(n,l),l}export{F as A,n as B,ue as C,U as D,de as E,M as F,o as H,A as I,g as L,N as M,ae as N,I as O,se as P,p as R,Ce as S,_e as T,e as U,a as V,t as W,Ke as _,ut as a,Te as b,Ye as c,We as d,Re as f,He as g,Ue as h,$e as i,P as j,ie as k,Ge as l,Fe as m,kt as n,pt as o,Le as p,ct as r,mt as s,Wt as t,G as u,K as v,V as w,we as x,Ne as y,r as z};