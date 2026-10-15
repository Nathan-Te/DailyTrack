(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=class{state;constructor(e){this.state=e>>>0}next(){this.state=this.state+1831565813>>>0;let e=this.state;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}int(e){return this.next()%e}chance(e){return this.int(100)<e}pick(e){return e[this.int(e.length)]}shuffle(e){let t=e.slice();for(let e=t.length-1;e>0;e--){let n=this.int(e+1);[t[e],t[n]]=[t[n],t[e]]}return t}};function t(e,t){let n=Math.imul((e|0)^2654435769,2246822507);return n^=n>>>13,n=Math.imul(n^(t|0),3266489909),n^=n>>>16,n>>>0}function n(e,t,n){let r=t<=2?e-1:e,i=Math.floor(r/400),a=r-i*400,o=Math.floor((153*(t+(t>2?-3:9))+2)/5)+n-1,s=a*365+Math.floor(a/4)-Math.floor(a/100)+o;return i*146097+s-719468}function r(e){let t=e+719468,n=Math.floor(t/146097),r=t-n*146097,i=Math.floor((r-Math.floor(r/1460)+Math.floor(r/36524)-Math.floor(r/146096))/365),a=r-(365*i+Math.floor(i/4)-Math.floor(i/100)),o=Math.floor((5*a+2)/153),s=a-Math.floor((153*o+2)/5)+1,c=o+(o<10?3:-9);return{y:i+n*400+ +(c<=2),m:c,d:s}}var i=(e,t)=>{let n=String(e);for(;n.length<t;)n=`0`+n;return n};function a(e){let{y:t,m:n,d:a}=r(e);return`${i(t,4)}-${i(n,2)}-${i(a,2)}`}function o(e){let t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;let r=n(Number(t[1]),Number(t[2]),Number(t[3]));return a(r)===e?r:null}var s=class extends Error{constructor(e){super(e),this.name=`CodecError`}},c=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`;function l(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2];t+=c[r>>2],t+=c[(r&3)<<4|(i??0)>>4],i!==void 0&&(t+=c[(i&15)<<2|(a??0)>>6]),a!==void 0&&(t+=c[a&63])}return t}function u(e){let t=[],n=0,r=0;for(let i=0;i<e.length;i++){let a=c.indexOf(e[i]);if(a<0)throw new s(`caractère invalide`);n=n<<6|a,r+=6,r>=8&&(r-=8,t.push(n>>r&255),n&=(1<<r)-1)}if(r>=6)throw new s(`longueur invalide`);return t}function d(e,t){for(;t>=128;)e.push(t&127|128),t>>=7;e.push(t)}function f(e,t=21){let n=0,r=0;for(;;){let i=e();if(n+=(i&127)*(1<<r),!(i&128))return n;if(r+=7,r>t)throw new s(`entier trop long`)}}var p=4096;function m(e,t){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t))throw RangeError(`idiv attend des entiers sûrs (${e}, ${t})`);if(t===0)throw RangeError(`idiv : division par zéro`);return(e-e%t)/t+0}function h(e){return e>=1&&e<=3}function g(e){return e>=4&&e<=7}var _=2048,v=72e3,y=4*p,b=1792,x=5632,S=class extends Error{constructor(e){super(e),this.name=`LevelError`}},C={"#":1,".":0,S:0,F:0,C:0,o:0,O:0,x:2,"*":3,"^":4,v:5,"<":6,">":7},w=m(p,2),T=(e,t)=>({x:e*p+w,y:t*p+w});function ee(e,t){let n=/^(\d+)(?:\.(\d{1,6}))?$/.exec(e);if(!n)throw new S(`${t} : « ${e} » n'est pas un nombre de tuiles`);let r=n[2]??``,i=1;for(let e=0;e<r.length;e++)i*=10;return m((Number(n[1])*i+(r?Number(r):0))*p*2+i,i*2)}function E(e,t,n){let r=t===`aller-retour`?[...e,...e.slice(1,-1).reverse()]:[...e],i=[],a=0;for(let e=0;e<r.length;e++){let t=r[e],n=r[(e+1)%r.length],o=(t.x>n.x?t.x-n.x:n.x-t.x)+(t.y>n.y?t.y-n.y:n.y-t.y);i.push(o),a+=o}let o=[0],s=0;for(let e=0;e<r.length;e++)s+=i[e],o.push(a===0?n:m(n*s,a));return{nodes:r,times:o}}function D(e){let t=e.replace(/\r/g,``).split(`
`);for(;t.length>0&&t[0].trim()===``;)t.shift();for(;t.length>0&&t[t.length-1].trim()===``;)t.pop();if(t.length===0)throw new S(`Niveau vide`);let n=t.findIndex(e=>e.trim()===``);n<0&&(n=t.length);let r=t.slice(0,n),i=t.slice(n),a=r[0].length,o=r.length;if(a>2048||o>512)throw new S(`Niveau trop grand (${a} × ${o}, au plus ${_} × 512)`);let s=[],c=[],l=[],u=[],d=[],f=[],p=[];for(let e=0;e<o;e++){let t=r[e];if(t.length!==a)throw new S(`Ligne ${e+1} : ${t.length} colonnes au lieu de ${a}`);for(let n=0;n<a;n++){let r=t[n],i=C[r];if(i===void 0)throw new S(`Ligne ${e+1}, colonne ${n+1} : caractère « ${r} » inconnu`);if(s.push(i),f.push(i===2?d.length:-1),i===2&&d.push({col:n,row:e}),r===`S`&&c.push({col:n,row:e}),r===`F`&&l.push({col:n,row:e}),r===`C`&&p.push({col:n,row:e}),r===`o`||r===`O`){let t=T(n,e);u.push({id:`${r}${u.length}`,radius:r===`o`?b:x,mode:`fixe`,points:[t],cycle:0,section:-1,nodes:[t],times:[0,0]})}}}p.sort((e,t)=>e.col-t.col||e.row-t.row);for(let e=1;e<p.length;e++)if(p[e].col===p[e-1].col)throw new S(`Deux points de passage « C » dans la colonne ${p[e].col+1} (un seul par colonne)`);if(c.length!==1)throw new S(`Il faut exactement un départ « S » (${c.length} trouvés)`);if(l.length!==1)throw new S(`Il faut exactement une arrivée « F » (${l.length} trouvées)`);let m=[],h=[];for(let e=0;e<i.length;e++){let t=i[e].trim();if(t===``||t.startsWith(`//`))continue;let r=t.split(/\s+/),o=`Annexe, ligne ${n+e+1}`;if(r[0]===`section`){let e=r.length===3?/^(\d+)-(\d+)$/.exec(r[2]):null;if(!e)throw new S(`${o} : « section <nom> <col0>-<col1> » attendu`);let t=Number(e[1]),n=Number(e[2]);if(t>n||n>=a)throw new S(`${o} : colonnes ${t}-${n} hors de la grille (0-${a-1})`);if(m.some(e=>e.name===r[1]))throw new S(`${o} : section « ${r[1]} » déjà déclarée`);let i=m.find(e=>t<=e.c1&&e.c0<=n);if(i)throw new S(`${o} : chevauche la section « ${i.name} »`);m.push({name:r[1],c0:t,c1:n})}else if(r[0]===`scie`)h.push({line:n+e+1,words:r});else throw new S(`${o} : déclaration « ${r[0]} » inconnue (section, scie)`)}for(let{line:e,words:t}of h){let n=`Annexe, ligne ${e}`;if(t.length<7)throw new S(`${n} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);let[,r,i,s,c]=t;if(u.some(e=>e.id===r))throw new S(`${n} : scie « ${r} » déjà déclarée`);let l=i===`o`?b:i===`O`?x:ee(i,n);if(l<=0||l>y)throw new S(`${n} : rayon hors bornes (au plus 4 tuiles)`);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>72e3)throw new S(`${n} : cycle en pas attendu (1 à ${v})`);if(c!==`aller-retour`&&c!==`boucle`)throw new S(`${n} : mode « ${c} » inconnu (aller-retour, boucle)`);let d=t.slice(5).map(e=>{let t=/^(\d+),(\d+)$/.exec(e);if(!t)throw new S(`${n} : point « ${e} » (col,rangée) attendu`);let r={col:Number(t[1]),row:Number(t[2])};if(r.col>=a||r.row>=o)throw new S(`${n} : point ${e} hors de la grille`);return r});if(d.length>32)throw new S(`${n} : au plus 32 points`);let f=m.findIndex(e=>d[0].col>=e.c0&&d[0].col<=e.c1);if(f<0)throw new S(`${n} : le premier point (colonne ${d[0].col}) n'est dans aucune section`);let p=d.map(e=>T(e.col,e.row)),h=Number(s);u.push({id:r,radius:l,mode:c,points:p,cycle:h,section:f,...E(p,c,h)})}return{width:a,height:o,tiles:s,start:c[0],finish:l[0],sections:m,saws:u,crumbles:d,crumbleIndex:f,checkpoints:p}}function O(e,t,n){return n>=e.height?0:t<0||n<0||t>=e.width?1:e.tiles[n*e.width+t]}function k(e){return{x:e.col*p,y:e.row*p}}function te(e,t){if(e.cycle===0||t<=0)return e.nodes[0];let n=t%e.cycle,r=e.nodes.length,i=0;for(;i<r-1&&n>=e.times[i+1];)i++;let a=e.nodes[i],o=e.nodes[(i+1)%r],s=e.times[i],c=e.times[i+1]-s;return c<=0?a:{x:a.x+m((o.x-a.x)*(n-s),c),y:a.y+m((o.y-a.y)*(n-s),c)}}var ne=12;function A(e){return e>>ne}function j(e,t,n,r,i){for(let a=r;a<=i;a++)for(let r=t;r<=n;r++)if(h(O(e,r,a)))return!0;return!1}function re(e,t,n,r,i){return j(e,A(t),A(t+r-1),A(n),A(n+i-1))}function ie(e,t,n,r,i,a,o){if(r===0)return{pos:t,blocked:!1};let s=A(i),c=A(i+a-1),l=t=>o?j(e,t,t,s,c):j(e,s,c,t,t);if(r>0){let e=A(t+n-1)+1,i=A(t+n+r-1);for(let t=e;t<=i;t++)if(l(t))return{pos:t*p-n,blocked:!0}}else{let e=A(t)-1,n=A(t+r);for(let t=e;t>=n;t--)if(l(t))return{pos:(t+1)*p,blocked:!0}}return{pos:t+r,blocked:!1}}var M=3072,N=3072,P=2048,F=Object.freeze({runSpeed:375,groundAccel:17,groundDecel:32,airAccel:13,airDecel:6,gravity:19,fallSpeed:751,jumpSpeed:800,jumpCut:340,slideSpeed:171,wallJumpX:340,wallJumpY:680,wallLock:0,wallReach:512,coyote:10,wallCoyote:6,jumpBuffer:12,cornerTolerance:1024,crumbleDelay:30,springSpeed:1056}),ae=Object.keys(F);function oe(e){return ae.every(t=>e[t]===F[t])}function se(e){let t=e.start.col*p+m(p-M,2),n=(e.start.row+1)*p-N,r=+!!re(e,t,n+1,3072,3072);return{x:t,y:n,vx:0,vy:0,ground:r,air:r?0:255,wallSide:0,wallAir:255,slide:0,buffer:0,held:0,jumping:0,lock:0,lockDir:0}}function ce(e){return e.ground?`sol`:e.slide===0?`air`:`mur`}var le=(e,t,n)=>e<t?t:e>n?n:e,I=(e,t,n)=>e<t?e+n>t?t:e+n:e-n<t?t:e-n;function L(e,t,n,r,i){let a=A(n),o=A(n+N-1),s=r<0?t:t+M,c=r<0?A(t)-1:A(t+M-1)+1,l=A(r<0?t-i-1:t+M+i);for(let t=c;r<0?t>=l:t<=l;t+=r)for(let n=a;n<=o;n++)if(h(O(e,t,n)))return r<0?s-(t+1)*p:t*p-s;return-1}function ue(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=r,a=(t&2?1:0)-(t&1?1:0),o=t&4?1:0,s=o===1&&e.held===0;e.lock>0&&a===e.lockDir&&(a=0);let c=e.lock>0?e.lock-1:0,l=c>0?e.lockDir:0,u=e.ground===1,d=u?i.groundAccel:i.airAccel,f=u?i.groundDecel:i.airDecel,m=e.vx;m=a===0?I(m,0,f):m*a<0?I(m,a*i.runSpeed,d>f?d:f):m*a>i.runSpeed?I(m,a*i.runSpeed,f):I(m,a*i.runSpeed,d);let g=e.vy,_=0;!u&&g>=0&&a!==0&&L(n,e.x,e.y,a,1)===0&&(_=a);let v=_===0?i.fallSpeed:i.slideSpeed;g=g<v?g+i.gravity>v?v:g+i.gravity:g-i.gravity<v?v:g-i.gravity;let y=e.air,b=e.wallAir,x=e.jumping,S=!1;if(s||e.buffer>0){if(u||e.air<=i.coyote)g=-i.jumpSpeed,S=!0,y=255;else{let t=L(n,e.x,e.y,-1,i.wallReach),r=L(n,e.x,e.y,1,i.wallReach),o=0;t>=0&&r>=0?o=a===0?t<=r?-1:1:a:t>=0?o=-1:r>=0?o=1:e.wallSide!==0&&e.wallAir<=i.wallCoyote&&(o=e.wallSide),o!==0&&(m=-o*i.wallJumpX,g=-i.wallJumpY,S=!0,_=0,b=255,c=i.wallLock,l=c>0?o:0)}}S&&(x=1);let C=S?0:s?i.jumpBuffer:e.buffer>0?e.buffer-1:0;x===1&&o===0&&g<-i.jumpCut&&(g=-i.jumpCut,x=0),g>=0&&(x=0),m=le(m,-2048,P),g=le(g,-2048,P);let w=e.x,T=e.y,ee=ie(n,w,M,m,T,N,!0);w=ee.pos,ee.blocked&&(m=0);let E=ie(n,T,N,g,w,M,!1);if(E.blocked&&g<0&&i.cornerTolerance>0){let e=A(E.pos)-1,t=A(w),r=A(w+M-1),a=h(O(n,t,e)),o=h(O(n,r,e)),s=w;t!==r&&a&&!o&&(t+1)*4096-w<=i.cornerTolerance?s=(t+1)*p:t!==r&&o&&!a&&w+3072-r*4096<=i.cornerTolerance&&(s=r*p-M),s!==w&&!re(n,s,T,3072,3072)&&(w=s,E=ie(n,T,N,g,w,M,!1))}T=E.pos,E.blocked&&(g<0&&(x=0),g=0);let D=g>=0&&re(n,w,T+1,3072,3072)?1:0;D?y=0:y<255&&(y+=1);let k=e.wallSide;if(D)k=0,b=255;else{let e=L(n,w,T,-1,1)===0,t=L(n,w,T,1,1)===0;e===t?e&&t?(k=a===0?k:a,b=0):b<255&&(b+=1):(k=e?-1:1,b=0)}return D&&(x=0),{x:w,y:T,vx:m+0,vy:g+0,ground:D,air:y,wallSide:k,wallAir:b,slide:_,buffer:C,held:o,jumping:x,lock:c,lockDir:l}}var de=[`aucune`,`pic`,`scie`,`chute`],R=1024,z=2048;function fe(e,t,n){let r=p,i=t*r,a=n*r,o=r-2*R;switch(e){case 4:return{x:i+R,y:a+r-z,w:o,h:z};case 5:return{x:i+R,y:a,w:o,h:z};case 6:return{x:i+r-z,y:a+R,w:z,h:o};case 7:return{x:i,y:a+R,w:z,h:o};default:throw RangeError(`spikeBox : la tuile ${e} n'est pas un pic`)}}function pe(e,t){return e.x<t.x+t.w&&t.x<e.x+e.w&&e.y<t.y+t.h&&t.y<e.y+e.h}var me=(e,t,n)=>e<t?t:e>n?n:e;function he(e,t,n){let r=e-me(e,n.x,n.x+n.w),i=t-me(t,n.y,n.y+n.h);return r*r+i*i}function ge(e,t,n,r){return he(e,t,r)<n*n}function B(e){return{status:0,time:0,player:se(e),tiles:e.tiles,crumbles:e.crumbles.map(()=>0),sections:e.sections.map(()=>-1),deathCause:0,deathX:0,deathY:0,deathTicks:0,springCell:-1,springTime:0,checkpoint:-1}}function V(e,t){let n=e.checkpoints[t.checkpoint],r=t.sections.map((t,r)=>e.sections[r].c1>=n.col?-1:t);return{...B(e),status:1,time:t.time,player:se({...e,start:n}),sections:r,checkpoint:t.checkpoint}}function _e(e,t,n){let r=e.saws[n];if(r.section<0)return 0;let i=t.sections[r.section];return i<0?0:t.time-i}function ve(e,t){return e.saws.map((n,r)=>te(n,_e(e,t,r)))}function ye(e){return{x:e.x,y:e.y,w:M,h:N}}function be(e,t){let n=t.player;if(n.y+3072>e.height*4096)return 3;let r=ye(n),i=A(n.x),a=A(n.x+M-1),o=A(n.y)<0?0:A(n.y),s=A(n.y+N-1);for(let t=o;t<=s;t++)for(let n=i;n<=a;n++){if(n<0||n>=e.width)continue;let i=e.tiles[t*e.width+n];if(g(i)&&pe(r,fe(i,n,t)))return 1}for(let n=0;n<e.saws.length;n++){let i=e.saws[n],a=te(i,_e(e,t,n));if(ge(a.x,a.y,i.radius,r))return 2}return 0}function xe(e,t){let n=p;return pe(ye(t),{x:e.finish.col*n,y:e.finish.row*n,w:n,h:n})}function Se(e,t){return t===e.tiles?e:{width:e.width,height:e.height,tiles:t}}function Ce(e,t,n){return t<0||n<0||t>=e.width||n>=e.height?-1:n*e.width+t}function H(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=t&4?1:0;if(e.status===3)return e;if(e.status===2){let t=e.deathTicks+1,r=e.checkpoint>=0?e.time+1:e.time;if(t<18)return{...e,deathTicks:t,time:r};if(e.checkpoint>=0){let t=V(n,{...e,time:r});return i&&(t.player={...t.player,held:1}),t}let a=B(n);return i&&(a.player={...a.player,held:1}),a}if(e.status===0){let n=t&3;if(!(n===1||n===2||i===1&&e.player.held===0))return e.player.held===i?e:{...e,player:{...e.player,held:i}}}let a=p,o=e.tiles,s=e.crumbles;for(let t=0;t<s.length;t++){let r=s[t];if(!(r<=0)&&(s===e.crumbles&&(s=[...s]),s[t]=r>1?r-1:-1,r===1)){o===e.tiles&&(o=[...o]);let r=n.crumbles[t];o[r.row*n.width+r.col]=0}}let c=ue(e.player,t,Se(n,o),r),l=c.ground===1,u=A(c.x),d=A(c.x+M-1),f=e.springCell,h=e.springTime;if(l&&r.springSpeed>0){let t=A(c.y+N),i=A(c.x+m(M,2)),a=-1;for(let e of[i,u,d]){let r=Ce(n,e,t);if(r>=0&&o[r]===3){a=r;break}}if(a>=0){let t=r.springSpeed<2048?r.springSpeed:P;c={...c,vy:-t,ground:0,air:255,jumping:0,buffer:0},f=a,h=e.time+1}}let g=(t,i)=>{let a=Ce(n,t,i);if(a<0)return;let o=n.crumbleIndex[a];o<0||s[o]!==0||(s===e.crumbles&&(s=[...s]),s[o]=r.crumbleDelay>1?r.crumbleDelay:1)};if(l){let e=A(c.y+N);for(let t=u;t<=d;t++)g(t,e)}else{let e=(t&2?1:0)-(t&1?1:0),n=A(c.y),r=A(c.y+N-1);if(e>0&&(c.x+3072)%a===0)for(let e=n;e<=r;e++)g(A(c.x+M),e);if(e<0&&c.x%a===0)for(let e=n;e<=r;e++)g(A(c.x)-1,e)}let _=e.time+1,v=e.sections,y=A(c.x+m(M,2));for(let t=0;t<v.length;t++){let r=n.sections[t];v[t]>=0||y<r.c0||y>r.c1||(v===e.sections&&(v=[...v]),v[t]=_)}let b={...e,status:1,time:_,player:c,tiles:o,crumbles:s,sections:v,springCell:f,springTime:h};if(xe(n,c))return{...b,status:3};let x=be(n,b);if(x!==0)return{...b,status:2,deathCause:x,deathX:c.x+m(M,2),deathY:c.y+m(N,2),deathTicks:0};let S=A(e.player.x+m(M,2));if(y>S){let e=b.checkpoint;for(let t=0;t<n.checkpoints.length;t++){let r=n.checkpoints[t].col;S<r&&r<=y&&(e=t)}if(e!==b.checkpoint)return{...b,checkpoint:e}}return b}var we=D(`
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
`);Object.freeze({floorRow:26,start:3,steps:[[33,1],[38,2],[43,3],[48,4]],coyoteLedge:57,gaps:[[75,2],[81,3],[88,4],[96,5],[105,6]],lowGaps:[[115,4,23],[124,3,24]],corridor:[133,10],chimneys:[[149,3],[154,2]],chimneyTopRow:16,wall:[163,12],slab:[171,18],slabHoles:[175,180,181,186],finish:193});var Te=D(`
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
`),Ee=D(`
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
`),U=72e3,De=/^[a-z0-9_:-]{1,40}$/,Oe=256,ke=4096,Ae=1,W=2,G=4,K=class extends Error{code;constructor(e,t){super(t),this.code=e,this.name=`JumpReplayError`}},je=Object.freeze({checkpoint:-1,held:0,time:0,sections:Object.freeze([]),elan:0});function q(e){let t=0;for(let n of e)t+=n.count;return t}function Me(e){let t=[];for(let n of e){let e=t[t.length-1];e&&e.bits===n?e.count++:t.push({count:1,bits:n})}return t}function Ne(e){let t=[];for(let n of e)for(let e=0;e<n.count;e++)t.push(n.bits);return t}function Pe(e){if(!De.test(e))throw new K(`format`,`Identifiant de niveau invalide : « ${e} »`)}function Fe(e){Pe(e.levelId);let t=e.start,n=[1];d(n,e.simVersion),n.push(e.levelId.length);for(let t=0;t<e.levelId.length;t++)n.push(e.levelId.charCodeAt(t));let r=t.checkpoint>=0;if(r&&t.elan)throw new K(`format`,`Départ lancé sur un point de passage`);if(n.push((t.held?Ae:0)|(r?W:0)|(t.elan?G:0)),r){d(n,t.checkpoint),d(n,t.time),d(n,t.sections.length);for(let e of t.sections)d(n,e+1)}let i=0;for(let t of e.runs){if(!Number.isInteger(t.count)||t.count<1)throw new K(`format`,`Série vide`);if(!Number.isInteger(t.bits)||t.bits<0||t.bits>7)throw new K(`format`,`Commande invalide : ${t.bits}`);if(i+=t.count,i>U)throw new K(`length`,`Rediffusion trop longue (plus de ${U} pas)`);d(n,t.count*8+t.bits)}return l(n)}function Ie(e){if(typeof e!=`string`||e.length===0)throw new K(`format`,`Rediffusion vide`);let t;try{t=u(e)}catch(e){throw e instanceof s?new K(`format`,`Rediffusion illisible (${e.message})`):e}let n=0,r=()=>{let e=t[n++];if(e===void 0)throw new K(`format`,`Rediffusion tronquée`);return e},i=e=>{try{return f(r)}catch(t){throw t instanceof s?new K(`format`,`${e} : entier trop long`):t}},a=r();if(a!==1)throw new K(`format`,`Format de rediffusion inconnu (${a})`);let o=i(`Version`),c=r(),l=``;for(let e=0;e<c;e++)l+=String.fromCharCode(r());Pe(l);let d=r();if(d&-8)throw new K(`format`,`Drapeaux de départ inconnus`);if(d&W&&d&G)throw new K(`format`,`Départ lancé sur un point de passage`);let p={checkpoint:-1,held:d&Ae?1:0,time:0,sections:[],elan:d&G?1:0};if(d&W){let e=i(`Point de passage`),t=i(`Chrono`),n=i(`Sections`);if(e>=ke)throw new K(`format`,`Point de passage hors limites`);if(t>U)throw new K(`length`,`Chrono de départ trop long`);if(n>Oe)throw new K(`format`,`Trop de sections`);let r=[];for(let e=0;e<n;e++){let e=i(`Section`)-1;if(e>t)throw new K(`format`,`Section mise en marche après le départ`);r.push(e)}p.checkpoint=e,p.time=t,p.sections=r}let h=[],g=0;for(;n<t.length;){let e=i(`Série`),t=e%8,n=m(e-t,8);if(n<1)throw new K(`format`,`Série vide`);if(g+=n,g>U)throw new K(`length`,`Rediffusion trop longue (plus de ${U} pas)`);h.push({count:n,bits:t})}return{simVersion:o,levelId:l,start:p,runs:h}}function J(e,t){if(t.checkpoint<0){let n=B(e);return!t.held&&!t.elan?n:{...n,player:{...n.player,held:+!!t.held,vx:t.elan?F.runSpeed:0}}}if(t.elan)throw new K(`format`,`Départ lancé sur un point de passage`);if(t.checkpoint>=e.checkpoints.length)throw new K(`level`,`Point de passage ${t.checkpoint} absent de ce niveau`);if(t.sections.length!==e.sections.length)throw new K(`level`,`Nombre de sections différent de celui du niveau`);let n=V(e,{...B(e),checkpoint:t.checkpoint,time:t.time,sections:t.sections});return t.held?{...n,player:{...n.player,held:1}}:n}function Le(e){return{checkpoint:e.checkpoint,held:e.player.held,time:e.time,sections:[...e.sections],elan:0}}function Re(e,t,n){if(t.simVersion!==3)throw new K(`version`,`Rediffusion d'une autre version de la simulation (${t.simVersion}, actuelle 3)`);if(n!==void 0&&t.levelId!==n)throw new K(`level`,`Rediffusion d'un autre niveau (« ${t.levelId} »)`);if(q(t.runs)>U)throw new K(`length`,`Rediffusion trop longue (plus de ${U} pas)`);return J(e,t.start)}function ze(e,t){return t.status===3||t.status===2&&e.status!==2&&t.checkpoint<0}function Be(e,t,n){let r=Re(e,t,n),i=[],a=[],o={start:{...t.start,sections:[...t.start.sections]},startTick:0,runs:[],ticks:0},s=0,c=!1;for(let n of t.runs)for(let t=0;t<n.count;t++){if(c)throw new K(`format`,`Pas après la fin de l'essai (pas ${s+1})`);let t=r;if(r=H(t,n.bits,e,F),s++,o){let e=o.runs[o.runs.length-1];e&&e.bits===n.bits?e.count++:o.runs.push({count:1,bits:n.bits}),o.ticks++}if(r.status===2&&t.status!==2){let e={cause:r.deathCause,x:r.deathX,y:r.deathY};i.push({tick:s,time:r.time,...e,life:a.length}),o&&a.push({index:a.length,...o,end:`mort`,death:e}),o=null}else r.status===1&&t.status===2?o={start:Le(r),startTick:s,runs:[],ticks:0}:r.status===3&&t.status!==3&&o&&(a.push({index:a.length,...o,end:`arrivée`,death:null}),o=null);ze(t,r)&&(c=!0)}return o&&o.ticks>0&&a.push({index:a.length,...o,end:`abandon`,death:null}),{finished:r.status===3,ticks:s,time:r.time,deaths:i,lives:a,final:r}}function Ve(e,t){return{simVersion:e.simVersion,levelId:e.levelId,start:t.start,runs:t.runs.map(e=>({...e}))}}var He=class{level;replay;state;prev;tick=0;total;run=0;left;constructor(e,t){this.level=e,this.replay=t,this.state=Re(e,t),this.prev=this.state,this.total=q(t.runs),this.left=t.runs[0]?.count??0}get done(){return this.tick>=this.total}next(){let e=this.replay.runs[this.run];return e?(this.left--,this.left===0&&(this.run++,this.left=this.replay.runs[this.run]?.count??0),e.bits):0}step(){return this.done?(this.prev=this.state,!1):(this.prev=this.state,this.state=H(this.state,this.next(),this.level,F),this.tick++,!0)}},Ue=class{levelId;inputs=[];count=0;held=0;active=!1;skipping=!1;constructor(e){this.levelId=e,Pe(e)}get recording(){return this.active}get ticks(){return this.count}step(e,t,n){if(this.skipping){if(n.status!==0)return null;this.skipping=!1}if(!this.active){if(e.status!==0||n.status===0)return null;this.active=!0,this.inputs=[],this.count=0,this.held=e.player.held}if(this.count>=U)return this.active=!1,this.skipping=!0,this.inputs=[],this.count=0,null;let r=this.inputs[this.inputs.length-1];return r&&r.bits===t?r.count++:this.inputs.push({count:1,bits:t}),this.count++,n.status===3?this.close(`arrivée`):ze(e,n)?this.close(`mort`):null}abandon(){return this.skipping=!1,!this.active||this.count===0?(this.active=!1,null):this.close(`abandon`)}peek(){return!this.active||this.count===0?null:this.replayOf()}replayOf(){return{simVersion:3,levelId:this.levelId,start:{...je,held:this.held},runs:this.inputs.map(e=>({...e}))}}close(e){let t=this.replayOf();return this.active=!1,this.inputs=[],this.count=0,{replay:t,end:e}}};function Y(e,t){return Math.imul(e^(t|0),16777619)>>>0}function We(e,t){let n=new He(e,t),r=2166136261,i=0;for(;n.step();){let e=n.state,t=e.player;for(let e of[t.x,t.y,t.vx,t.vy,t.ground,t.air,t.wallSide,t.wallAir,t.slide,t.buffer,t.held,t.jumping,t.lock,t.lockDir])r=Y(r,e);for(let t of[e.status,e.time,e.deathCause,e.deathX,e.deathY,e.deathTicks,e.springCell,e.springTime,e.checkpoint])r=Y(r,t);for(let t of e.crumbles)r=Y(r,t);for(let t of e.sections)r=Y(r,t);e.status===2&&n.prev.status!==2&&i++}return{hash:r.toString(16).padStart(8,`0`),finished:n.state.status===3,ticks:n.tick,time:n.state.time,deaths:i}}var Ge=480,X=e=>A(e.player.x+m(M,2));function Ke(e,t){let n=Ne(t.runs),r=[],i=e.checkpoints.map(()=>-1),a=J(e,t.start);for(let t=0;t<n.length;t++)a=H(a,n[t],e,F),a.checkpoint>=0&&i[a.checkpoint]===-1&&(i[a.checkpoint]=t+1,r[a.checkpoint]=a);return{inputs:n,resume:i.map((t,i)=>{if(t<0)return-1;let a=V(e,r[i]),o=t,s=-1;for(let r=t-120<0?0:t-120;r<=t+30&&r<n.length;r+=2){let t=a,i=X(t);for(let a=0;a<360&&r+a<n.length&&(t=H(t,n[r+a],e,F),t.status===1);a++){let e=X(t);e>i&&(i=e)}t.status===3&&(i+=1e4),i>s&&(s=i,o=r)}return o})}}function qe(t,n,r,i){let a=new e(r),o=Ke(t,n),s=i.maxLives??6,c=J(t,n.start),l=[],u=(e,t)=>{let n=e+a.int(t);return[n,n+4+a.int(37),a.int(8)]};for(let e=0;e<i.attempts;e++){let e=[u(0,a.chance(50)?m(o.inputs.length,3):o.inputs.length)],r=new Ue(n.levelId),i=c,d=0,f=1,p=X(i),h=0,g=null;for(;;){let n=o.inputs[d]??0;for(let[t,r,i]of e)d>=t&&d<r&&(n=i);let c=i;if(i=H(c,n,t,F),g=r.step(c,n,i),g)break;d++;let l=X(i);if(l>p)p=l,h=0;else if(++h>Ge){g=r.abandon();break}if(i.status===1&&c.status===2){if(++f>s){g=r.abandon();break}d=o.resume[i.checkpoint]??0,d<0&&(d=0),h=0,p=X(i),a.chance(70)&&e.push(u(d,360))}}g&&l.push(g)}return l}var Je=`id: ascenseur
intention: Franchir un fossé où une scie monte et descend : sauter quand elle est en bas.
etiquettes: scie
paliers: 10 10
repeter: trou colonnes 14-14
variante: trou=1 cycle=240
variante: trou=1 cycle=180
variante: trou=2 cycle=240
grille:
............................
............................
............................
............................
............................
............................
............................
............................
............................
............................
############...#############
############...#############
############...#############
############...#############
############...#############

scie ascenseur o {cycle} aller-retour 13,13 13,3
(id: cheminee-pics
intention: Monter une cheminée dont chaque mur porte une plaque de pics : choisir le bon mur à chaque hauteur.
etiquettes: mural precision vertical
paliers: 17 6
repeter: plaque rangees 13-13
repeter: plaque rangees 8-8
variante: plaque=1
variante: plaque=2
grille:
#########.............
#########.............
#########.............
#########.............
#########.............
#########.............
#########...##########
#########>..##########
#########>..##########
#########...##########
#########...##########
#########...##########
#########..<##########
....#####..<##########
....#####...##########
............##########
............##########
######################
######################
######################
(id: cheminee-scie
intention: Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment.
etiquettes: mural scie vertical
paliers: 17 6
repeter: haut rangees 10-10
variante: haut=1 cycle=360
variante: haut=1 cycle=480
variante: haut=1 cycle=420
variante: haut=2 cycle=480
grille:
#########.............
#########.............
#########.............
#########.............
#########.............
#########.............
#########...##########
#########...##########
#########...##########
#########...##########
#########...##########
#########...##########
#########...##########
....#####...##########
....#####...##########
............##########
............##########
######################
######################
######################

scie va-et-vient o {cycle} aller-retour 10,2 10,8
(id: cheminee
intention: Monter une cheminée en sautant d'un mur à l'autre, puis sortir par le haut.
etiquettes: mural vertical
paliers: 17 6
repeter: large colonnes 12-12
repeter: haut rangees 10-10
variante: large=1 haut=1
variante: large=2 haut=3
variante: large=2 haut=6
grille:
###########............
###########............
###########............
###########............
###########............
###########............
###########..##########
###########..##########
###########..##########
###########..##########
###########..##########
###########..##########
###########..##########
....#######..##########
....#######..##########
.............##########
.............##########
#######################
#######################
#######################
(id: demi-tour
intention: Sauter contre le bas d'un mur hérissé, rebondir en arrière sur une corniche, puis repartir par-dessus le mur.
etiquettes: mural
paliers: 15 8
repeter: ecart colonnes 13-13
variante: ecart=1
variante: ecart=2
variante: ecart=3
grille:
..........................
..........................
..........................
..........................
..........................
..........................
..........................
..........................
................##########
...............<##########
.........###...<##########
...............<##########
................##########
................##########
................##########
##########################
##########################
(id: descente
intention: Se laisser tomber de corniche en corniche jusqu'en bas, sans freiner.
etiquettes: respiration
paliers: 4 16
repeter: large colonnes 7-7
repeter: large colonnes 10-10
repeter: large colonnes 13-13
repeter: large colonnes 16-16
repeter: large colonnes 19-19
variante: large=1
variante: large=2
variante: large=4
grille:
..........................
..........................
..........................
..........................
#####.....................
#####.....................
########..................
########..................
###########...............
###########...............
##############............
##############............
#################.........
#################.........
####################......
####################......
##########################
##########################
##########################
##########################
(id: escalier-friable
intention: Gravir un escalier de blocs friables suspendu au-dessus du vide, d'une seule traite.
etiquettes: friable vertical
paliers: 17 7
repeter: large colonnes 8-8
repeter: large colonnes 12-12
repeter: large colonnes 16-16
repeter: large colonnes 20-20
variante: large=1
variante: large=2
grille:
..............................
..............................
..............................
..............................
..............................
..............................
..............................
.......................#######
.......................#######
...................xxx.#######
.......................#######
...............xxx.....#######
.......................#######
...........xxx.........#######
.......................#######
.......xxx.............#######
.......................#######
######.................#######
######.................#######
######.................#######
(id: escalier
intention: Gravir un escalier de grandes marches, un bond par marche, sans casser son élan.
etiquettes: respiration vertical
paliers: 12 4
repeter: large colonnes 7-7
repeter: large colonnes 10-10
repeter: large colonnes 13-13
repeter: large colonnes 16-16
variante: large=1
variante: large=2
variante: large=3
grille:
............................
............................
............................
............................
..............##############
..............##############
...........#################
...........#################
........####################
........####################
.....#######################
.....#######################
############################
############################
(id: grande-scie
intention: Sauter un trou sous une grande scie : un petit saut passe, un grand s'y jette.
etiquettes: scie precision
paliers: 10 10
repeter: trou colonnes 12-12
variante: trou=1
variante: trou=2
variante: trou=3
grille:
............................
............................
............................
............................
............................
............................
.............O..............
............................
............................
............................
############...#############
############...#############
############...#############
(id: iles-friables
intention: Sauter d'îlot friable en îlot friable, chacun un peu plus haut, sans jamais s'y poser longtemps.
etiquettes: friable precision
paliers: 12 7
repeter: ecart colonnes 7-7
repeter: ecart colonnes 12-12
repeter: ecart colonnes 17-17
repeter: ecart colonnes 22-22
repeter: ecart colonnes 25-25
variante: ecart=1
variante: ecart=2
grille:
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..........................####
.......................xx.####
..................xx......####
.............xx...........####
........xx................####
######....................####
######....................####
######....................####
(id: lucarne
intention: Passer d'un saut par la petite fenêtre de deux murs minces.
etiquettes: precision
paliers: 10 10
repeter: fenetre rangees 6-6
variante: fenetre=2
variante: fenetre=1
grille:
............#.........#.........
............#.........#.........
............#.........#.........
............#.........#.........
............#.........#.........
............#...................
................................
......................#.........
............#.........#.........
............#.........#.........
################################
################################
(id: mur-friable
intention: Monter une cheminée au-dessus d'un puits de pics : son mur gauche s'effrite, pas question de traîner.
etiquettes: mural friable vertical
paliers: 17 7
repeter: haut rangees 10-10
variante: haut=1
variante: haut=3
variante: haut=5
grille:
#########............
#########............
#########............
########x............
########x............
########x............
########x............
########x..##########
########x..##########
########x..##########
########x..##########
########x..##########
########x..##########
....####x..##########
....####x..##########
...........##########
...........##########
#########..##########
#########..##########
#########^^##########
#####################
(id: mur-seul
intention: Remonter un grand mur tout seul, saut mural après saut mural, en revenant vers lui.
etiquettes: mural vertical
paliers: 12 6
repeter: haut rangees 9-9
variante: haut=1
variante: haut=3
variante: haut=5
grille:
.................
.................
.................
.................
.................
.................
..........#######
..........#######
..........#######
..........#######
..........#######
..........#######
#################
#################
(id: petits-trous
intention: Sauter trois petits trous en courant, sans lever le pied de l'accélérateur.
etiquettes: respiration
paliers: 8 8
repeter: trou colonnes 7-7
repeter: trou colonnes 15-15
repeter: trou colonnes 24-24
variante: trou=1
variante: trou=2
variante: trou=3
grille:
................................
................................
................................
................................
................................
................................
................................
................................
#######.#######.########.#######
#######.#######.########.#######
#######.#######.########.#######
(id: piliers
intention: Bondir de pilier en pilier, chacun large d'une seule tuile, au-dessus du vide.
etiquettes: precision
paliers: 10 10
repeter: ecart colonnes 8-8
repeter: ecart colonnes 12-12
repeter: ecart colonnes 16-16
repeter: ecart colonnes 20-20
repeter: ecart colonnes 24-24
variante: ecart=1
variante: ecart=2
grille:
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..............................
..............................
.............#.......#........
######...#...#...#...#...#####
######...#...#...#...#...#####
######...#...#...#...#...#####
######...#...#...#...#...#####
(id: plafond-pics
intention: Courir sous un plafond hérissé et enjamber les pics du sol par petits sauts : un grand saut s'y empale.
etiquettes: precision
paliers: 10 10
repeter: pics colonnes 11-11
repeter: pics colonnes 17-17
repeter: pics colonnes 23-23
variante: pics=1
variante: pics=2
variante: pics=3
grille:
.......####################.......
.......####################.......
.......####################.......
.......####################.......
.......####################.......
.......####################.......
.......vvvvvvvvvvvvvvvvvvvv.......
..................................
..................................
...........^.....^.....^..........
##################################
##################################
(// Respiration : un plat, une marche, encore un plat.
id: plaine
intention: Courir sur un plat et monter une marche basse : de quoi reprendre son souffle.
etiquettes: respiration
paliers: 9 8
repeter: long colonnes 6-6
variante: long=6
variante: long=12
variante: long=18
grille:
........................
........................
........................
........................
........................
........................
........................
........................
............############
########################
########################
########################
(id: pont-friable
intention: Traverser un pont qui s'effondre derrière soi, sans jamais s'arrêter.
etiquettes: friable
paliers: 9 9
repeter: long colonnes 13-13
variante: long=1
variante: long=5
variante: long=9
grille:
............................
............................
............................
............................
............................
............................
............................
............................
............................
########xxxxxxxxxxxx########
########............########
########............########
(id: puits
intention: Se laisser glisser contre le mur d'un puits pour ne pas manquer la porte de sortie, au-dessus des pics du fond.
etiquettes: mural vertical
paliers: 4 18
repeter: large colonnes 7-7
repeter: prof rangees 9-9
variante: large=1 prof=1
variante: large=2 prof=4
variante: large=1 prof=7
grille:
.........############
.........############
.........############
.........############
######...############
######...############
######...############
######...############
######...############
######...############
######...############
######...############
######...############
######...############
######...............
######...............
######...............
######...............
######...############
######^^^############
#####################
#####################
(id: quinconce
intention: Passer entre des scies en quinconce : sauter celles du sol, rester sous celles du haut.
etiquettes: scie precision
paliers: 11 11
repeter: ecart colonnes 11-11
repeter: ecart colonnes 14-14
repeter: ecart colonnes 17-17
repeter: ecart colonnes 20-20
repeter: ecart colonnes 23-23
variante: ecart=2
variante: ecart=3
grille:
......####################......
......####################......
......####################......
......####################......
......####################......
......####################......
................................
............o.....o.....o.......
................................
................................
.........o.....o.....o..........
################################
################################
(id: ressort-mur
intention: Prendre le ressort au pied d'un mur hérissé et retomber sur son sommet, sans frôler les pics.
etiquettes: ressort vertical
paliers: 19 13
repeter: ecart colonnes 11-11
variante: ecart=1
variante: ecart=2
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
......................
......................
......................
..............########
.............<########
.............<########
.............<########
.............<########
.............<########
#########*############
######################
######################
(id: ressort-plafond
intention: Le ressort lance sous un plafond à pics : arriver assez vite pour le dépasser et se poser sur la corniche.
etiquettes: ressort precision
paliers: 18 13
repeter: bord colonnes 10-10
variante: bord=1
variante: bord=2
variante: bord=3
grille:
..........................
..........................
..........................
..........................
..........................
..........................
..........................
..........................
..........................
.....######...............
.....######...............
.....vvvvvv...............
..........................
.............#############
.............#############
.............#############
.............#############
.............#############
#########*################
##########################
##########################
(id: ressorts-trous
intention: Rebondir de ressort en ressort au-dessus d'une fosse à pics, sans lâcher la course.
etiquettes: ressort precision
paliers: 13 13
repeter: ecart colonnes 15-15
repeter: ecart colonnes 26-26
repeter: ecart colonnes 37-37
variante: ecart=1
variante: ecart=2
grille:
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
..............................................
#######^^***^^^^^^^^***^^^^^^^^***^^^^^^######
##############################################
##############################################
(id: saut-long
intention: Prendre tout son élan et franchir un grand trou d'un seul saut.
etiquettes: precision
paliers: 9 9
repeter: trou colonnes 11-11
variante: trou=5
variante: trou=6
variante: trou=7
grille:
............................
............................
............................
............................
............................
............................
............................
............................
............................
###########.################
###########.################
###########.################
(id: scie-ronde
intention: Passer sous un bloc suspendu pendant que la scie qui en fait le tour est au-dessus.
etiquettes: scie
paliers: 10 10
variante: cycle=240
variante: cycle=180
variante: cycle=150
grille:
..............................
..............................
..............................
..............................
..............................
..............................
.............##...............
.............##...............
..............................
..............................
##############################
##############################
##############################

scie ronde o {cycle} boucle 12,5 15,5 15,9 12,9
(id: scie-sol
intention: Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires.
etiquettes: scie
paliers: 10 10
variante: cycle=300
variante: cycle=240
variante: cycle=180
grille:
......##################......
......##################......
......##################......
......##################......
......##################......
......##################......
......##################......
..............................
..............................
..............................
##############################
##############################

scie patrouille o {cycle} aller-retour 8,9 21,9
scie contre o {cycle} aller-retour 21,9 8,9
(id: tunnel
intention: Traverser un tunnel bas en courant : un saut s'y cognerait la tête.
etiquettes: respiration
paliers: 9 9
repeter: long colonnes 12-12
variante: long=4
variante: long=10
variante: long=16
grille:
.......############.......
.......############.......
.......############.......
.......############.......
.......############.......
.......############.......
.......############.......
..........................
..........................
##########################
##########################
##########################
`.split(`(`),Ye={jumpSimVersion:3,exigenceVersion:1,modules:{ascenseur:{variants:[{grid:`1b80a03a`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowABQINKIHNqoL`,ticks:312,fastest:312,gigue:[1e3,980,895],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowBLIHProL`,ticks:308,fastest:308,gigue:[1e3,1e3,935],raccord:1e3,exigence:1}},{grid:`d9cd36ad`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxABQIHKIH7gs`,ticks:311,fastest:312,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxBLoH7gs`,ticks:308,fastest:308,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1808cb7f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyAAwYHMIILvoK`,ticks:323,fastest:323,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyBLIINpoL`,ticks:319,fastest:319,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}}]},"cheminee-pics":{variants:[{grid:`bd792ba8`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MACKBdYBSDTlARDOARpmTSA9pgg`,ticks:344,fastest:339,gigue:[895,520,325],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MATKBMYBMZUCEOYBCjxOVRElhggi`,ticks:332,fastest:332,gigue:[1e3,815,580],raccord:1e3,exigence:3}},{grid:`511e259d`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQCqBY4BUN0BKUU-WhWZAbYBGK0BCRSiCA`,ticks:372,fastest:372,gigue:[985,825,605],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQSqBmi8ARKWATAkQUwStgEahQESKaYICg`,ticks:367,fastest:362,gigue:[885,580,160],raccord:1e3,exigence:4}}]},"cheminee-scie":{variants:[{grid:`28242929`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MACCB0B9ErYBCDyNAUKGCDI`,ticks:326,fastest:320,gigue:[770,265,130],raccord:null,exigence:5},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MASyBjAJZS4SjgEqNLUBEqYIEg`,ticks:314,fastest:310,gigue:[525,260,120],raccord:958,exigence:5}},{grid:`73bb54e6`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQC6BYYBQP0BCJQBSuUBEUz6Bw`,ticks:336,fastest:336,gigue:[875,480,280],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQTiBKYBMf0BGJYBIvUBGk7qBw`,ticks:325,fastest:326,gigue:[1e3,850,450],raccord:1e3,exigence:3}},{grid:`33e092fc`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgDKBWZA_QESngEi5QEINI4I`,ticks:329,fastest:327,gigue:[910,600,355],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgSyBigJrQERrgESFOUBEKYIEg`,ticks:320,fastest:318,gigue:[935,515,305],raccord:1e3,exigence:4}},{grid:`bce7721f`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwA0EBSeBig03QEIxAEybI0BCgkILJYI`,ticks:346,fastest:346,gigue:[900,420,185],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwTSBLYBOY0CIK4BSfUBCT1G0gc`,ticks:338,fastest:338,gigue:[1e3,800,525],raccord:1e3,exigence:3}}]},cheminee:{variants:[{grid:`ed68c430`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAAHBAcugdOClYKHkQlCl4KXiUJHUSGBxI`,ticks:317,fastest:317,gigue:[785,450,275],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAEwgdWCk4KHkQlCl4KXiUJHUSWBw`,ticks:310,fastest:310,gigue:[625,600,380],raccord:667,exigence:4}},{grid:`e49c3866`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEADAgc2gfeAQoWLE08ErYBCh4seb4I`,ticks:362,fastest:363,gigue:[1e3,1e3,930],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEEwgfmARokbSQirgEKFiSRAa4I`,ticks:355,fastest:355,gigue:[680,605,485],raccord:667,exigence:4}},{grid:`aec800d5`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIAqgggGYUBCq4BEqUBKo4BMjRlMq4I`,ticks:385,fastest:385,gigue:[875,580,315],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIE-gXGAVF1ET2GAQg8hQEKfkQKPoUBCr4I`,ticks:376,fastest:373,gigue:[960,795,565],raccord:1e3,exigence:3}}]},"demi-tour":{variants:[{grid:`81eac41f`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowAHKWBSreAjlAlQIRLe4I`,ticks:341,fastest:343,gigue:[1e3,970,870],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowBKIE5gEKjgQypgG6CQ`,ticks:339,fastest:339,gigue:[1e3,935,885],raccord:1e3,exigence:2}},{grid:`bc4882dc`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxAMIBpgYSrgEizgIKjgoq`,ticks:359,fastest:359,gigue:[765,695,500],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxBBpOogPGAiLGA0AcQiihAVruCQ`,ticks:376,fastest:382,gigue:[1e3,975,925],raccord:1e3,exigence:1}},{grid:`4c399709`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyAAwIJI4BwgNGigMwDE1EbQwWECxeHQ6yAp4Bggk`,ticks:399,fastest:401,gigue:[755,530,300],raccord:null,exigence:5},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyBEoO4gLeAYoB9gUIbIYK`,ticks:366,fastest:367,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},descente:{variants:[{grid:`9d8594d2`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAAHAgcwgMm4gQm-gg`,ticks:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAEogImsg8`,ticks:286,fastest:286,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`bcec8572`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEAHAgcogMm4gQmogUmkgc`,ticks:345,fastest:345,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEEggMm4gomggc`,ticks:340,fastest:340,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`2570cb33`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIAHAgc-hs`,ticks:454,fastest:454,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIEggEm8ho`,ticks:450,fastest:450,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"escalier-friable":{variants:[{grid:`c46b8a55`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MACiAbYECo4B0gJm0gJmogI0NYYF`,ticks:344,fastest:340,gigue:[1e3,965,810],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MASSAbYEIkb6AWa6AlayAl7KBQ`,ticks:330,fastest:330,gigue:[840,460,225],raccord:1e3,exigence:4}},{grid:`bf32daf1`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQCCAqYEMqYBggNmogKOAaoD5gU`,ticks:384,fastest:384,gigue:[1e3,1e3,940],raccord:null,exigence:1},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQQ6vgQylgGCA5YBsgNmggPWBQo`,ticks:373,fastest:373,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]},escalier:{variants:[{grid:`8597f3cb`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAAygF-2gK-AzLGCjI`,ticks:318,fastest:312,gigue:[1e3,970,840],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAEjgHKAmaiAtYM`,ticks:308,fastest:308,gigue:[865,700,430],raccord:1e3,exigence:3}},{grid:`d7e610ba`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEAHBAc9gMSZsoCdroCngs`,ticks:357,fastest:357,gigue:[1e3,1e3,885],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEEjgG6ApYB0gJmogLGCxo`,ticks:351,fastest:351,gigue:[1e3,910,635],raccord:1e3,exigence:2}},{grid:`c1b51846`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIA2gFu4gJmkgK-AeoChg0`,ticks:406,fastest:400,gigue:[1e3,995,880],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIElgGCA5YB0gLGBDLWCyo`,ticks:395,fastest:395,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}}]},"grande-scie":{variants:[{grid:`54c52887`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAA8gkO-gk`,ticks:318,fastest:312,gigue:[1e3,985,870],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAEsgRGkgMOmgs`,ticks:308,fastest:308,gigue:[985,935,880],raccord:1e3,exigence:2}},{grid:`2973b43e`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEAJAgkqgUWigMOkgs`,ticks:324,fastest:323,gigue:[1e3,855,825],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEE0gUOggMOmgs`,ticks:319,fastest:319,gigue:[1e3,890,795],raccord:1e3,exigence:2}},{grid:`20c5c984`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIAFBAsigkOmgs`,ticks:334,fastest:334,gigue:[835,615,450],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIEogkmkgs`,ticks:330,fastest:330,gigue:[555,540,320],raccord:917,exigence:5}}]},"iles-friables":{variants:[{grid:`d0bf753f`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MAAcCCRe-gPuBDJu4gPuBRo`,ticks:334,fastest:334,gigue:[1e3,1e3,845],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MAR2ggSWBRJe0gOWAYoF`,ticks:330,fastest:330,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`ad804d6e`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQAMIGQe2gNGwgJ--gKuAfoCpgGKA166Aw`,ticks:392,fastest:389,gigue:[1e3,990,900],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQS6Ac4EQo4B-gLWAfoCrgGKA06CBA`,ticks:384,fastest:384,gigue:[1e3,980,815],raccord:1e3,exigence:2}}]},lucarne:{variants:[{grid:`489ef2fc`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MAAkCBziBKYBggXmCgo`,ticks:357,fastest:357,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MASGAaIEhgHiAibCA4YJGg`,ticks:351,fastest:349,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`a0ef9966`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQAcCCTaBI4B4gImwgOmCSI`,ticks:356,fastest:356,gigue:[1e3,930,830],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQTGAeIDhgHiAibCA4YJGg`,ticks:351,fastest:351,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}}]},"mur-friable":{variants:[{grid:`dc84ce14`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAADAgckgamAQoeRCUKXgo-ISXGBwo`,ticks:288,fastest:288,gigue:[1e3,805,610],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAEugTOAQq-AQh8CDwIfAk9hgdC`,ticks:288,fastest:285,gigue:[1e3,1e3,895],raccord:1e3,exigence:2}},{grid:`7bfb1b84`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEAggXeAQpeCoYBCHwKfgh8CDyGByo`,ticks:309,fastest:305,gigue:[1e3,720,590],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEEsgYdTApWPQktPgh8CTU0CS00lgcK`,ticks:301,fastest:301,gigue:[900,910,655],raccord:1e3,exigence:2}},{grid:`f63513b4`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIADAgsggZWCjYiHkQlCl4KXiUJHUYKPi0JFcYHCg`,ticks:316,fastest:316,gigue:[885,560,380],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIEwgTGAQq-AQg8Rgg8Rgh8Cj4KPkQKvgc6`,ticks:319,fastest:313,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}}]},"mur-seul":{variants:[{grid:`909f5b11`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAADBA8tgQK1gFKlgg`,ticks:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAEImaiA6YCIaYICg`,ticks:241,fastest:241,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ffc6b621`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEAJAgcxgQKngIKngMKnggK`,ticks:301,fastest:301,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEEWl7CA9YBCr4BggKGCDI`,ticks:294,fastest:294,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`81a9d331`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIAigI-sgPWAQr-AgrOAeoBxgH6Bg`,ticks:358,fastest:358,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIEfroDtgIKngGSAp4BmgL2BzI`,ticks:348,fastest:348,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]},"petits-trous":{variants:[{grid:`aa08c30c`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowAAwIHKoDLtoENrIF5gc`,ticks:354,fastest:356,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowBLICRtoFHroF5gc`,ticks:351,fastest:351,gigue:[1e3,1e3,875],raccord:1e3,exigence:2}},{grid:`3db1b5e5`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxAAwIFLIDNsIFTqoG5gc`,ticks:386,fastest:389,gigue:[1e3,980,915],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxBIoDTuoFPpoGTrIH`,ticks:384,fastest:384,gigue:[1e3,1e3,915],raccord:1e3,exigence:1}},{grid:`26172342`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyAAwIJNoDTsIGPooHTooH`,ticks:420,fastest:421,gigue:[1e3,1e3,925],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyBNoDXooGVooHPsIH`,ticks:417,fastest:417,gigue:[1e3,970,870],raccord:1e3,exigence:2}}]},piliers:{variants:[{grid:`3db582ea`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MAAUCBzaBKYBmgMWogP-Bw`,ticks:333,fastest:334,gigue:[1e3,1e3,945],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MATiBO4B-gIW2gN-sgY`,ticks:330,fastest:330,gigue:[1e3,1e3,935],raccord:1e3,exigence:1}},{grid:`6d365105`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQCaBR6KA1baAibKAzaaAs4G`,ticks:395,fastest:389,gigue:[1e3,930,670],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQTyBA6iAz6iAg6aA2baAh6iBg`,ticks:384,fastest:384,gigue:[1e3,900,705],raccord:1e3,exigence:2}}]},"plafond-pics":{variants:[{grid:`011c5c74`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowAAwYHIoHLpoDHtIDRqoI`,ticks:378,fastest:378,gigue:[1e3,920,845],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowBKIHLroDJooDPsoI`,ticks:373,fastest:373,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}},{grid:`51abd8d9`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxABwIJJIHLtIENrIDRvII`,ticks:411,fastest:411,gigue:[1e3,860,625],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxBKIHNrIENvoDPtII`,ticks:406,fastest:406,gigue:[1e3,1e3,870],raccord:1e3,exigence:2}},{grid:`712f7279`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyAAwIJJoHPvoERpIFPsoI`,ticks:441,fastest:443,gigue:[1e3,950,625],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyBLoHPooFPvIERtoI`,ticks:439,fastest:439,gigue:[1e3,970,550],raccord:1e3,exigence:3}}]},plaine:{variants:[{grid:`3a1c57a5`,arret:{code:`AQMPbW9kdWxlOnBsYWluZTowABwIHPoKNroI`,ticks:323,fastest:323,gigue:[1e3,1e3,930],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZTowBPoKhgk`,ticks:319,fastest:319,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1da5fbe0`,arret:{code:`AQMPbW9kdWxlOnBsYWluZToxABwIHPIOPsoI`,ticks:389,fastest:389,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZToxBJIPNsII`,ticks:384,fastest:384,gigue:[1e3,1e3,925],raccord:1e3,exigence:1}},{grid:`25687fab`,arret:{code:`AQMPbW9kdWxlOnBsYWluZToyABwIHPoShgk`,ticks:454,fastest:454,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZToyBJoTNsoI`,ticks:450,fastest:450,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},"pont-friable":{variants:[{grid:`0b9ae282`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowABwIHIoT`,ticks:312,fastest:312,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowBKIT`,ticks:308,fastest:308,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`b72b81df`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxABwIHOoV`,ticks:356,fastest:356,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxBPoV`,ticks:351,fastest:351,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c7819723`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyABwIHMoY`,ticks:400,fastest:400,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyBNoY`,ticks:395,fastest:395,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},puits:{variants:[{grid:`bddcde31`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjAAogI28gFgMaAC6gk`,ticks:283,fastest:280,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjAEggHGA0DBAUDaCQ`,ticks:267,fastest:267,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cc63828a`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjEAogI28gFgMaACkgEwogk`,ticks:298,fastest:298,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjEEggGGBECBAcAB4gk`,ticks:284,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`27ab3245`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjIAogI2kgTBAbIL`,ticks:314,fastest:313,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjIEal6CA-ADYZIK`,ticks:306,fastest:301,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},quinconce:{variants:[{grid:`789174e8`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowACQIFNIFXuoEXuIDTpIJ`,ticks:411,fastest:411,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowBPIFXuIEXsoDTqIJ`,ticks:406,fastest:406,gigue:[1e3,1e3,915],raccord:1e3,exigence:1}},{grid:`2f8e34ae`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxABwIJMoFlgHqBX7yBKYK`,ticks:465,fastest:465,gigue:[1e3,985,870],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxBPIFfvIFhgHiBLYK`,ticks:461,fastest:461,gigue:[1e3,1e3,940],raccord:1e3,exigence:1}}]},"ressort-mur":{variants:[{grid:`dc7e8fa5`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAAJAgc5g4i`,ticks:248,fastest:248,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAESh7yAhayCw`,ticks:242,fastest:242,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cedfc129`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEAJAgcxg8a`,ticks:259,fastest:259,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEESh7yAhaKDA`,ticks:253,fastest:253,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-plafond":{variants:[{grid:`0a88fc81`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowADQILKYRMg`,ticks:294,fastest:294,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowBNYRIg`,ticks:286,fastest:286,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`2fdab1c7`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxAJIC9gcKfgo-2gc`,ticks:307,fastest:343,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxBNYFMrYDCCyWAQouygk`,ticks:333,fastest:331,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`94a1d0cd`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyABwgZuIDZqIDpgFihgwi`,ticks:371,fastest:371,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyBP4FEo4ECq4MCg`,ticks:361,fastest:361,gigue:[1e3,935,780],raccord:1e3,exigence:2}}]},"ressorts-trous":{variants:[{grid:`1f599899`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAAHAg0ogUO8hk`,ticks:509,fastest:509,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAEogUmgho`,ticks:504,fastest:504,gigue:[1e3,1e3,910],raccord:1e3,exigence:1}},{grid:`71989c1e`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEAJAgM-gUOwhs`,ticks:542,fastest:542,gigue:[615,370,285],raccord:null,exigence:5},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEE6gUW0hs`,ticks:537,fastest:537,gigue:[690,420,470],raccord:1e3,exigence:5}}]},"saut-long":{variants:[{grid:`afdab2f3`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowABwIHKIIzg0`,ticks:356,fastest:356,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowBPoHhg4`,ticks:351,fastest:351,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`07d22558`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxABwIJKoIXroN`,ticks:367,fastest:367,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxBLoIng4`,ticks:362,fastest:362,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cf074791`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyABQQJKoIfvIN`,ticks:378,fastest:378,gigue:[1e3,985,895],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyBLoI9g4`,ticks:373,fastest:373,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-ronde":{variants:[{grid:`b86e0514`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MADSCb4LGg`,ticks:340,fastest:334,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MASCCcYLEg`,ticks:330,fastest:330,gigue:[1e3,1e3,860],raccord:1e3,exigence:2}},{grid:`d54df661`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQA0CDSSBTZgMmFaMfoBNvIJ`,ticks:343,fastest:342,gigue:[720,720,635],raccord:null,exigence:2},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQTCB0DCAiaiCg`,ticks:336,fastest:335,gigue:[710,665,535],raccord:1e3,exigence:3}},{grid:`5efb6cdc`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgAcCBy6FA`,ticks:334,fastest:334,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgSCCiaiCg`,ticks:328,fastest:328,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-sol":{variants:[{grid:`fb55c197`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAAFAgU8gW2BCL-CQo`,ticks:333,fastest:334,gigue:[1e3,980,845],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAE-gW2BBqGChI`,ticks:330,fastest:330,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`76b29e13`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEADBgsggXmAzLmAzKOBw`,ticks:334,fastest:334,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEEkgXmAyL-Axq2Bw`,ticks:330,fastest:330,gigue:[1e3,1e3,905],raccord:1e3,exigence:1}},{grid:`a4e8d18b`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIADAgcsgTuAhqmAyLGCQo`,ticks:332,fastest:334,gigue:[1e3,1e3,945],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIEugT2AmLWAiLWCQo`,ticks:330,fastest:330,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},tunnel:{variants:[{grid:`d56cf356`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDowABwIHIINZoIBZpIE`,ticks:321,fastest:321,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDowBOIOJuoE`,ticks:317,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`659d1761`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoxABwIHOISJuoE`,ticks:388,fastest:388,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoxBKIRZoIBZpIE`,ticks:382,fastest:382,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`16d8abd0`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoyABwIHOIWJuoE`,ticks:452,fastest:452,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoyBIIXJuoE`,ticks:449,fastest:449,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]}}},Xe=[`mural`,`precision`,`vertical`,`scie`,`friable`,`ressort`,`respiration`],Ze=[`arret`,`elan`],Z=class extends Error{constructor(e){super(e),this.name=`ModuleError`}},Qe=new Set([`id`,`intention`,`etiquettes`,`paliers`,`repeter`,`variante`]),$e=/^[#.^v<>oOx*]+$/;function et(e){let t=e.replace(/\r/g,``).split(`
`),n=0,r={};for(;n<t.length;n++){let e=t[n].trim();if(e===``||e.startsWith(`//`))continue;if(e===`grille:`)break;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(!i||!Qe.has(i[1]))throw new Z(`Ligne ${n+1} : « clé: valeur » attendu (${[...Qe].join(`, `)}, puis « grille: »)`);(r[i[1]]??=[]).push(i[2].trim())}if(n>=t.length)throw new Z(`« grille: » manquant`);let i=e=>{let t=r[e];if(!t||t.length!==1||t[0]===``)throw new Z(`« ${e}: » attendu une fois`);return t[0]},a=i(`id`);if(!/^[a-z0-9-]{1,24}$/.test(a))throw new Z(`id « ${a} » invalide (minuscules, chiffres, tirets, 24 au plus)`);let o=e=>`Morceau « ${a} » : ${e}`,s=i(`intention`),c=i(`etiquettes`).split(/\s+/);for(let e of c)if(!Xe.includes(e))throw new Z(o(`étiquette « ${e} » inconnue (${Xe.join(`, `)})`));if(new Set(c).size!==c.length)throw new Z(o(`étiquette en double`));let l=/^(\d+)\s+(\d+)$/.exec(i(`paliers`));if(!l)throw new Z(o(`« paliers: <rangée d'entrée> <rangée de sortie> » attendu`));n++;let u=[];for(;n<t.length&&t[n].trim()!==``;n++)u.push(t[n].trim());let d=t.slice(n).map(e=>e.trim()).filter(e=>e!==``&&!e.startsWith(`//`));if(u.length===0)throw new Z(o(`grille vide`));let f=u[0].length;u.forEach((e,t)=>{if(e.length!==f)throw new Z(o(`rangée ${t} : ${e.length} colonnes au lieu de ${f}`));if(!$e.test(e))throw new Z(o(`rangée ${t} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`))});let p=Number(l[1]),m=Number(l[2]);if(p>=u.length||m>=u.length)throw new Z(o(`rangée de palier hors de la grille`));let h=[],g=(r.repeter??[]).map(e=>{let t=/^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(e);if(!t)throw new Z(o(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${e} »)`));let n={param:t[1],axis:t[2],from:Number(t[3]),to:Number(t[4])},r=n.axis===`colonnes`?f:u.length;if(n.from>n.to||n.to>=r)throw new Z(o(`plage ${n.from}-${n.to} hors du gabarit`));return h.includes(n.param)||h.push(n.param),n});for(let e of g)for(let t of g)if(e!==t&&e.axis===t.axis&&e.from<=t.to&&t.from<=e.to)throw new Z(o(`les plages ${e.from}-${e.to} et ${t.from}-${t.to} se chevauchent`));for(let e of d)for(let t of e.matchAll(/\{([a-z][a-z0-9]*)\}/g))h.includes(t[1])||h.push(t[1]);for(let e of[p,m])if(g.some(t=>t.axis===`rangees`&&e>=t.from&&e<=t.to))throw new Z(o(`une rangée de palier ne se répète pas`));let _=(r.variante??[]).map((e,t)=>{let n={};for(let r of e.split(/\s+/).filter(Boolean)){let e=/^([a-z][a-z0-9]*)=(\d+)$/.exec(r);if(!e)throw new Z(o(`variante ${t} : « nom=valeur » attendu (« ${r} »)`));if(!h.includes(e[1]))throw new Z(o(`variante ${t} : paramètre « ${e[1]} » inconnu`));let i=Number(e[2]),a=g.some(t=>t.param===e[1])?40:v;if(i>a)throw new Z(o(`variante ${t} : ${e[1]} = ${i} (au plus ${a})`));n[e[1]]=i}for(let e of h)if(n[e]===void 0)throw new Z(o(`variante ${t} : « ${e} » manque`));return n});if(_.length===0)throw new Z(o(`au moins une « variante: » (même sans paramètre)`));return{id:a,intention:s,tags:c,entryRow:p,exitRow:m,repeats:g,params:h,variants:_,grid:u,annex:d,text:e}}function tt(e,t,n){let r=[],i=Array(e).fill(-1),a=Array(e).fill(-1);for(let o=0;o<e;){let e=t.find(e=>e.from===o),s=e?e.to:o,c=e?n[e.param]:1;for(let e=0;e<c;e++)for(let t=o;t<=s;t++)e===0&&(i[t]=r.length),a[t]=r.length,r.push(t);o=s+1}return{src:r,first:i,last:a}}function nt(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t.toString(16).padStart(8,`0`)}function rt(e,t,n={}){let r=e.variants[t];if(!r)throw new Z(`Morceau « ${e.id} » : pas de variante ${t} (0 à ${e.variants.length-1})`);let i=n.lancement??0;if(!Number.isInteger(i)||i<0||i>40)throw new Z(`lancement : de 0 à 40 colonnes`);let a=n=>`Morceau « ${e.id} », variante ${t} : ${n}`,o=tt(e.grid[0].length,e.repeats.filter(e=>e.axis===`colonnes`),r),s=tt(e.grid.length,e.repeats.filter(e=>e.axis===`rangees`),r),c=o.src.length,l=s.src.length;if(l>30)throw new Z(a(`${l} rangées (au plus 30)`));if(c<6)throw new Z(a(`trop étroit`));let u=s.first[e.entryRow],d=s.first[e.exitRow],f=1+i,p=s.src.map(t=>o.src.map(n=>e.grid[t][n]).join(``)),m=p.map((e,t)=>{let n=e[0].repeat(f),r=e[c-1];return(t===u-1?`S`+n.slice(1):n)+e+(t===d-1?`F`:r)});if(p[u-1]?.[0]!==`.`||p[d-1]?.[c-1]!==`.`)throw new Z(a(`le départ et l'arrivée se posent sur des tuiles vides`));let h=[`section ${e.id} ${f}-${f+c-1}`];for(let t of e.annex){let e=t.replace(/\{([a-z][a-z0-9]*)\}/g,(e,t)=>String(r[t])).split(/\s+/);if(e[0]!==`scie`)throw new Z(a(`bloc annexe : seules les scies sont permises (« ${e[0]} »)`));h.push(e.map((e,t)=>{let n=t>=5?/^(\d+)('?),(\d+)('?)$/.exec(e):null;if(!n)return e;let r=Number(n[1]),i=Number(n[3]),c=(n[2]?o.last:o.first)[r],l=(n[4]?s.last:s.first)[i];if(c===void 0||l===void 0||c<0||l<0)throw new Z(a(`point ${e} hors du gabarit ou retiré par la variante`));return`${c+f},${l}`}).join(` `))}let g=m.join(`
`)+`

`+h.join(`
`)+`
`,_;try{_=D(g)}catch(e){throw e instanceof S?new Z(a(e.message)):e}let v={id:e.id,variant:t,values:r,levelId:`module:${e.id}:${t}`,level:_,ascii:g,hash:nt(g),lead:f,width:c,height:l,entryRow:u,exitRow:d},y=it(v);if(y.length>0)throw new Z(a(y.join(` ; `)));return v}function it(e){let t=[],n=e.level,r=p,i=[{name:`entrée`,c0:e.lead,row:e.entryRow},{name:`sortie`,c0:e.lead+e.width-3,row:e.exitRow}];for(let a of i){a.row-4<0&&t.push(`palier d'${a.name} : moins de 4 rangées au-dessus`);for(let r=a.c0;r<a.c0+3;r++){n.tiles[a.row*n.width+r]!==1&&t.push(`palier d'${a.name} : colonne ${r-e.lead} sans sol plein`);for(let i=Math.max(0,a.row-4);i<a.row;i++)n.tiles[i*n.width+r]!==0&&t.push(`palier d'${a.name} : tuile (${r-e.lead}, ${i}) occupée`)}let i={x:a.c0*r,y:(a.row-4)*r,w:3*r,h:4*r};for(let e of n.saws){let n=e.cycle===0?1:e.cycle;for(let r=0;r<n;r++){let n=te(e,r);if(ge(n.x,n.y,e.radius,i)){t.push(`palier d'${a.name} : la scie ${e.id} y passe`);break}}}}return t}var at=Je.map(et);function ot(e){let t=at.find(t=>t.id===e);if(!t)throw new Z(`Morceau « ${e} » inconnu`);return t}function st(e,t,n={}){return rt(ot(e),t,n)}function ct(e,t){return Ye.jumpSimVersion===3?Ye.modules[e]?.variants[t]??null:null}function lt(e){return!e||!e.arret||!e.elan||e.arret.exigence===0||e.elan.exigence===0?0:Math.max(e.arret.exigence,e.elan.exigence)}var ut=n(2026,10,16);function dt(e){return e-ut+1}function ft(e){return`jour-${a(e)}-g1`}var pt=3e3,mt=4800,ht=3600,gt=3360,_t=3840,vt=1785689458,yt={gold:110,silver:130,bronze:160},bt=`repos4310:`;function xt(e){return Number.parseInt(nt(`${bt}${e}`),16)%3}function St(e,t){return xt(e)===(t%3+3)%3}var Ct=(e,t)=>m(e*t+99,100);function wt(e){return{author:e,gold:Ct(e,yt.gold),silver:Ct(e,yt.silver),bronze:Ct(e,yt.bronze)}}function Tt(e,t){return e<=t.author?`author`:e<=t.gold?`gold`:e<=t.silver?`silver`:e<=t.bronze?`bronze`:null}var Et=null;function Dt(){return Et||(Et=at.map(e=>e.variants.flatMap((t,n)=>{let r=ct(e.id,n),i=lt(r);if(!r?.arret||!r.elan||i<1)return[];let a=st(e.id,n);return[{id:e.id,variant:n,tags:e.tags,exigence:i,arret:r.arret.ticks,elan:r.elan.ticks,height:a.height,width:a.width,entryRow:a.entryRow,exitRow:a.exitRow}]})).filter(e=>e.length>0),Et)}var Q=(e,t)=>e.tags.includes(t),Ot=e=>e.entry===`arret`?e.choice.arret:e.choice.elan;function kt(e){let t=[],n=0;e.forEach((r,i)=>{i>0&&(n=t[i-1]+e[i-1].choice.exitRow-r.choice.entryRow),t.push(n)});let r=0,i=0;return e.forEach((e,n)=>{(n===0||t[n]<r)&&(r=t[n]),(n===0||t[n]+e.choice.height>i)&&(i=t[n]+e.choice.height)}),{tops:t.map(e=>e-r+1),height:i-r+1}}var $=(e,t)=>m(e*1e3,t);function At(e,t){let n=Dt().filter(t=>!St(t[0].id,e)),r=[],i=new Set,a=0;for(;;){if(r.length>=10)return`trop de morceaux`;let e=r.length===0,o=e?`arret`:`elan`,s=$(a,ht),c=130+m(200*(s<1e3?s:1e3),1e3),l=r.length>=2&&r.slice(-2).every(e=>Q(e.choice,`precision`)),u=!r.some(e=>Q(e.choice,`mural`)),d=!r.some(e=>Q(e.choice,`scie`)),f=!r.some(e=>Q(e.choice,`respiration`)),p=!r.some(e=>e.choice.exigence>=4),h=(e,t)=>{let n=a+m(t,2);return n>=m(_t*350,1e3)&&n<=m(gt*650,1e3)&&Q(e,`respiration`)},g=f&&a+240>=m(_t*350,1e3),_=u&&s>=550,v=d&&s>=550,y=p&&s>=667,b=[];for(let s of n){let n=s[0].id;if(i.has(n))continue;let p=s[0].tags;if(l&&p.includes(`precision`)||p.includes(`respiration`)&&!f||g&&!p.includes(`respiration`)||(_||v)&&!(_&&p.includes(`mural`)||v&&p.includes(`scie`)))continue;let m=s.filter(t=>{let n={choice:t,entry:o},i=Ot(n)+(e?0:9);if(Q(t,`respiration`)&&!h(t,i)||y&&t.exigence<4)return!1;let s=a+i;if(s>_t)return!1;if(s>=gt){let e=[...r.map(e=>e.choice),t];if(!e.some(e=>Q(e,`mural`))||!e.some(e=>Q(e,`scie`))||!e.some(e=>Q(e,`respiration`))||!e.some(e=>e.exigence>=4)||e.length<6)return!1}return kt([...r,n]).height<=48});if(m.length===0)continue;let x=[],S=1/0;for(let e of m){let t=Math.abs(e.exigence*100-c);t<S?(S=t,x=[e]):t===S&&x.push(e)}let C=x.length===1?x[0]:t.pick(x),w=S<=50?8:S<=100?5:S<=200?2:1;(u&&Q(C,`mural`)||d&&Q(C,`scie`))&&(w*=2),b.push({pick:{choice:C,entry:o},weight:w})}if(b.length===0)return`impasse au morceau ${r.length+1}`;let x=0;for(let e of b)x+=e.weight;let S=t.int(x),C=b[0];for(let e of b){if(S<e.weight){C=e;break}S-=e.weight}if(r.push(C.pick),i.add(C.pick.choice.id),a+=Ot(C.pick)+(r.length>1?9:0),a>=gt)return r}}function jt(e){let t=Dt().flat(),n=e.map((e,n)=>{let r=t.find(t=>t.id===e.id&&t.variant===e.variant);if(!r)throw RangeError(`Morceau « ${e.id} », variante ${e.variant} : pas de solution utilisable`);return{choice:r,entry:n===0?`arret`:`elan`}});if(n.length===0)throw RangeError(`Assemblage vide`);let{tops:r,height:i}=kt(n),a=n.reduce((e,t)=>e+t.choice.width,0)+n.length+1,o=[];for(let e=0;e<i;e++)o.push(Array(a).fill(`#`));let s=[],c=[],l=[],u=[],d=1;n.forEach((e,t)=>{let n=st(e.choice.id,e.choice.variant),[a,f=``]=n.ascii.split(`

`),p=a.split(`
`).map(e=>e.slice(n.lead,n.lead+n.width));u.push(p);let m=r[t];for(let e=0;e<p.length;e++)for(let t=0;t<n.width;t++)o[m+e][d+t]=p[e][t];let h=p[p.length-1];for(let e=0;e<n.width;e++)if(h[e]!==`#`)for(let t=m+p.length;t<i;t++)o[t][d+e]=`.`;s.push(`section ${e.choice.id} ${d}-${d+n.width-1}`);for(let t of f.split(`
`)){let r=t.trim().split(/\s+/);r[0]===`scie`&&s.push(r.map((t,r)=>{if(r===1)return`${e.choice.id}/${t}`;let i=r>=5?/^(\d+),(\d+)$/.exec(t):null;return i?`${Number(i[1])-n.lead+d},${Number(i[2])+m}`:t}).join(` `))}l.push(d-1),c.push({id:e.choice.id,variant:e.choice.variant,entry:e.entry,tags:e.choice.tags,exigence:e.choice.exigence,solutionTicks:Ot(e),col0:d,col1:d+n.width-1,top:m,entryRow:m+n.entryRow,exitRow:m+n.exitRow,start:0,end:0}),d+=n.width+1});let f=(e,t,n)=>{let r=u[e];if(!r)return!1;let i=t-c[e].top;return i<0||i>=r.length?!1:r[i][n===`first`?0:r[i].length-1]===`.`};for(let e=0;e<=n.length;e++){let t=e===0?0:c[e-1].col1+1,r=e<n.length?c[e].entryRow:c[e-1].exitRow;for(let n=0;n<r;n++)o[n][t]=f(e-1,n,`last`)||f(e,n,`first`)?`.`:`#`;o[r-1][t]=e===0?`S`:e===n.length?`F`:`C`}let p=o.map(e=>e.join(``)).join(`
`)+`

`+s.join(`
`)+`
`;return{level:D(p),ascii:p,pieces:c,calls:l}}var Mt=e=>e*p+m(p-M,2),Nt=60;function Pt(e,t,n,r){let i=e.pieces[t],a=ct(i.id,i.variant)?.[i.entry];if(!a)return null;let o=[],s=t===e.pieces.length-1;for(let e of Ne(Ie(a.code).runs)){if(n=r(n,e),o.push(e),n.status===2)return null;if(n.status===3)return s?{inputs:o,after:n,before:n}:null}let c=s?0:Mt(e.calls[t+1]),l=n;for(let e=0;e<Nt;e++){if(!s&&n.player.x>=c)return{inputs:o,after:n,before:l};if(l=n,n=r(n,2),o.push(2),n.status===2)return null;if(n.status===3)return s?{inputs:o,after:n,before:n}:null}return null}function Ft(e){let t=e.level,n=(e,n)=>H(e,n,t,F),r=[],i=[],a=B(t),o=a,s=[];for(let t=0;t<e.pieces.length;t++){let c=e.pieces[t],l=[{state:a,drop:0}];if(t>0){let n=Mt(e.calls[t]),r={state:a,drop:0},i={state:o,drop:1};l=n-o.player.x<a.player.x-n?[i,r]:[r,i]}let u=null,d=0;for(let r of l)if(u=Pt(e,t,r.state,n),u){d=r.drop;break}if(!u)return`${c.id}:${c.variant} n'aboutit pas (morceau ${t+1})`;r.push(...s.slice(0,s.length-d)),i.push(r.length),s=u.inputs,a=u.after,o=u.before}return r.push(...s),{inputs:r,starts:i}}function It(e,t){let n=0,r=[[0,0],[0,0],[0,0]];for(let i of e){n+=i.exigence;let e=m(i.start+i.end,2),a=e*3<t?0:e*3<t*2?1:2;r[a][0]+=i.exigence*(i.end-i.start),r[a][1]+=i.end-i.start}let i=e=>e[1]===0?0:m(e[0]*10,e[1]);return{sum:n,rate:t>0?m(n*10*60*120,t):0,thirds:[i(r[0]),i(r[1]),i(r[2])]}}function Lt(e){let t=[],{pieces:n,authorTicks:r}=e;(r<pt||r>mt)&&t.push(`temps de l'auteur ${r} pas hors de [${pt}, ${mt}]`),(n.length<6||n.length>10)&&t.push(`${n.length} morceaux (de 6 à 10)`),e.level.height>48&&t.push(`hauteur ${e.level.height} (au plus 48)`),new Set(n.map(e=>e.id)).size!==n.length&&t.push(`morceau en double`),n.some(e=>e.tags.includes(`mural`))||t.push(`aucun morceau mural`),n.some(e=>e.tags.includes(`scie`))||t.push(`aucun morceau scie`);let i=0;for(let e of n)i=e.tags.includes(`precision`)?i+1:0,i>2&&t.push(`plus de 2 morceaux precision d'affilée`);let a=n.filter(e=>e.tags.includes(`respiration`));a.length!==1&&t.push(`${a.length} morceaux respiration (un seul, au milieu)`);for(let e of a){let n=$(e.start+e.end,2*r);(n<350||n>650)&&t.push(`respiration à ${n} ‰ (entre 350 et 650)`)}(n[0]?.entry!==`arret`||n.slice(1).some(e=>e.entry!==`elan`))&&t.push(`entrées : le premier à l'arrêt, les autres en élan`),n.some(e=>e.exigence>=4)||t.push(`aucun morceau d'exigence 4 ou plus`);let o=e.exigence;return(o.rate<380||o.rate>460)&&t.push(`exigence ${o.rate} hors de [380, 460]`),o.thirds[2]<o.thirds[0]&&t.push(`le dernier tiers (${o.thirds[2]}) est moins exigeant que le premier (${o.thirds[0]})`),t}function Rt(e,t){return $(Math.abs(e-ht),ht)+$(Math.abs(t-420),420)}function zt(e,t){let n;try{n=jt(e)}catch(e){return`assemblage : ${e.message}`}let r=Ft(n);if(typeof r==`string`)return r;let i={simVersion:3,levelId:t,start:{checkpoint:-1,held:0,time:0,sections:[],elan:0},runs:Me(r.inputs)},a=Be(n.level,i,t);if(!a.finished)return`le rejeu n'arrive pas`;if(a.deaths.length>0)return`le rejeu meurt ${a.deaths.length} fois`;let o=a.time,s=n.pieces.map((e,t)=>({...e,start:r.starts[t],end:t+1<n.pieces.length?r.starts[t+1]:o})),c={id:t,level:n.level,ascii:n.ascii,hash:nt(n.ascii),pieces:s,replay:i,code:Fe(i),authorTicks:o,medals:wt(o),exigence:It(s,o)};return{built:c,problems:Lt(c)}}var Bt=[{id:`mur-seul`,variant:2},{id:`quinconce`,variant:0},{id:`piliers`,variant:1},{id:`escalier`,variant:1},{id:`cheminee-scie`,variant:3},{id:`scie-ronde`,variant:0},{id:`demi-tour`,variant:1},{id:`puits`,variant:1},{id:`mur-friable`,variant:1},{id:`lucarne`,variant:1}],Vt=new Map;function Ht(n){let r=Vt.get(n);if(r)return r;let i=ft(n),o=t(n,vt),s=[],c=null;for(let r=0;r<40&&!(r>=6&&c);r++){let a=At(n,new e(t(o,r)));if(typeof a==`string`){s.push({index:r,status:`impasse`,reason:a,pieces:[],ticks:0,rate:0,score:0});continue}let l=a.map(e=>`${e.choice.id}:${e.choice.variant}`),u=zt(a.map(e=>({id:e.choice.id,variant:e.choice.variant})),i);if(typeof u==`string`){s.push({index:r,status:`refusé`,reason:u,pieces:l,ticks:0,rate:0,score:0});continue}let{built:d,problems:f}=u,p=Rt(d.authorTicks,d.exigence.rate),m=f.length>0?`refusé`:`valide`;s.push({index:r,status:m,reason:f.join(` ; `),pieces:l,ticks:d.authorTicks,rate:d.exigence.rate,score:p}),!(f.length>0)&&(!c||p<c.score)&&(c={built:d,index:r,score:p})}let l;if(c)l={...c.built,day:n,date:a(n),number:dt(n),attempts:s,chosen:c.index,fallback:!1};else{let e=zt(Bt,i);if(typeof e==`string`||e.problems.length>0)throw Error(`Niveau de secours invalide : ${typeof e==`string`?e:e.problems.join(` ; `)}`);l={...e.built,day:n,date:a(n),number:dt(n),attempts:s,chosen:-1,fallback:!0}}return Vt.set(n,l),l}export{P as A,n as B,de as C,H as D,fe as E,A as F,o as H,k as I,g as L,M,oe as N,F as O,ce as P,p as R,we as S,ve as T,e as U,a as V,t as W,We as _,st as a,Ee as b,qe as c,He as d,Ie as f,Be as g,Ve as h,Ze as i,N as j,ae as k,Ue as l,Ne as m,Tt as n,ct as o,Fe as p,at as r,lt as s,Ht as t,K as u,J as v,B as w,Te as x,q as y,r as z};