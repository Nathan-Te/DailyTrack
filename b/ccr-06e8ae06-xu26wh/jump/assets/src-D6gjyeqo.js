var e=class{state;constructor(e){this.state=e>>>0}next(){this.state=this.state+1831565813>>>0;let e=this.state;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}int(e){return this.next()%e}chance(e){return this.int(100)<e}pick(e){return e[this.int(e.length)]}shuffle(e){let t=e.slice();for(let e=t.length-1;e>0;e--){let n=this.int(e+1);[t[e],t[n]]=[t[n],t[e]]}return t}};function t(e,t){let n=Math.imul((e|0)^2654435769,2246822507);return n^=n>>>13,n=Math.imul(n^(t|0),3266489909),n^=n>>>16,n>>>0}function n(e,t,n){let r=t<=2?e-1:e,i=Math.floor(r/400),a=r-i*400,o=Math.floor((153*(t+(t>2?-3:9))+2)/5)+n-1,s=a*365+Math.floor(a/4)-Math.floor(a/100)+o;return i*146097+s-719468}function r(e){let t=e+719468,n=Math.floor(t/146097),r=t-n*146097,i=Math.floor((r-Math.floor(r/1460)+Math.floor(r/36524)-Math.floor(r/146096))/365),a=r-(365*i+Math.floor(i/4)-Math.floor(i/100)),o=Math.floor((5*a+2)/153),s=a-Math.floor((153*o+2)/5)+1,c=o+(o<10?3:-9);return{y:i+n*400+ +(c<=2),m:c,d:s}}var i=(e,t)=>{let n=String(e);for(;n.length<t;)n=`0`+n;return n};function a(e){let{y:t,m:n,d:a}=r(e);return`${i(t,4)}-${i(n,2)}-${i(a,2)}`}function o(e){let t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return null;let r=n(Number(t[1]),Number(t[2]),Number(t[3]));return a(r)===e?r:null}var s=class extends Error{constructor(e){super(e),this.name=`CodecError`}},c=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`;function l(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2];t+=c[r>>2],t+=c[(r&3)<<4|(i??0)>>4],i!==void 0&&(t+=c[(i&15)<<2|(a??0)>>6]),a!==void 0&&(t+=c[a&63])}return t}function u(e){let t=[],n=0,r=0;for(let i=0;i<e.length;i++){let a=c.indexOf(e[i]);if(a<0)throw new s(`caractère invalide`);n=n<<6|a,r+=6,r>=8&&(r-=8,t.push(n>>r&255),n&=(1<<r)-1)}if(r>=6)throw new s(`longueur invalide`);return t}function d(e,t){for(;t>=128;)e.push(t&127|128),t>>=7;e.push(t)}function f(e,t=21){let n=0,r=0;for(;;){let i=e();if(n+=(i&127)*(1<<r),!(i&128))return n;if(r+=7,r>t)throw new s(`entier trop long`)}}var p=4096;function m(e,t){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t))throw RangeError(`idiv attend des entiers sûrs (${e}, ${t})`);if(t===0)throw RangeError(`idiv : division par zéro`);return(e-e%t)/t+0}function h(e){return e>=1&&e<=3||e>=8}function g(e){return e>=4&&e<=7}var _=2048,v=72e3,y=4*p,b=1792,x=5632,S=class extends Error{constructor(e){super(e),this.name=`LevelError`}},C={"#":1,".":0,S:0,F:0,C:0,o:0,O:0,x:2,"*":3,"[":8,"]":9,"~":10,"^":4,v:5,"<":6,">":7},w=m(p,2),T=(e,t)=>({x:e*p+w,y:t*p+w});function E(e,t){let n=/^(\d+)(?:\.(\d{1,6}))?$/.exec(e);if(!n)throw new S(`${t} : « ${e} » n'est pas un nombre de tuiles`);let r=n[2]??``,i=1;for(let e=0;e<r.length;e++)i*=10;return m((Number(n[1])*i+(r?Number(r):0))*p*2+i,i*2)}function D(e,t,n){let r=t===`aller-retour`?[...e,...e.slice(1,-1).reverse()]:[...e],i=[],a=0;for(let e=0;e<r.length;e++){let t=r[e],n=r[(e+1)%r.length],o=(t.x>n.x?t.x-n.x:n.x-t.x)+(t.y>n.y?t.y-n.y:n.y-t.y);i.push(o),a+=o}let o=[0],s=0;for(let e=0;e<r.length;e++)s+=i[e],o.push(a===0?n:m(n*s,a));return{nodes:r,times:o}}function O(e){let t=e.replace(/\r/g,``).split(`
`);for(;t.length>0&&t[0].trim()===``;)t.shift();for(;t.length>0&&t[t.length-1].trim()===``;)t.pop();if(t.length===0)throw new S(`Niveau vide`);let n=t.findIndex(e=>e.trim()===``);n<0&&(n=t.length);let r=t.slice(0,n),i=t.slice(n),a=r[0].length,o=r.length;if(a>2048||o>512)throw new S(`Niveau trop grand (${a} × ${o}, au plus ${_} × 512)`);let s=[],c=[],l=[],u=[],d=[],f=[],p=[];for(let e=0;e<o;e++){let t=r[e];if(t.length!==a)throw new S(`Ligne ${e+1} : ${t.length} colonnes au lieu de ${a}`);for(let n=0;n<a;n++){let r=t[n],i=C[r];if(i===void 0)throw new S(`Ligne ${e+1}, colonne ${n+1} : caractère « ${r} » inconnu`);if(s.push(i),f.push(i===2?d.length:-1),i===2&&d.push({col:n,row:e}),r===`S`&&c.push({col:n,row:e}),r===`F`&&l.push({col:n,row:e}),r===`C`&&p.push({col:n,row:e}),r===`o`||r===`O`){let t=T(n,e);u.push({id:`${r}${u.length}`,radius:r===`o`?b:x,mode:`fixe`,points:[t],cycle:0,section:-1,nodes:[t],times:[0,0]})}}}p.sort((e,t)=>e.col-t.col||e.row-t.row);for(let e=1;e<p.length;e++)if(p[e].col===p[e-1].col)throw new S(`Deux points de passage « C » dans la colonne ${p[e].col+1} (un seul par colonne)`);if(c.length!==1)throw new S(`Il faut exactement un départ « S » (${c.length} trouvés)`);if(l.length!==1)throw new S(`Il faut exactement une arrivée « F » (${l.length} trouvées)`);let m=[],h=[];for(let e=0;e<i.length;e++){let t=i[e].trim();if(t===``||t.startsWith(`//`))continue;let r=t.split(/\s+/),o=`Annexe, ligne ${n+e+1}`;if(r[0]===`section`){let e=r.length===3?/^(\d+)-(\d+)$/.exec(r[2]):null;if(!e)throw new S(`${o} : « section <nom> <col0>-<col1> » attendu`);let t=Number(e[1]),n=Number(e[2]);if(t>n||n>=a)throw new S(`${o} : colonnes ${t}-${n} hors de la grille (0-${a-1})`);if(m.some(e=>e.name===r[1]))throw new S(`${o} : section « ${r[1]} » déjà déclarée`);let i=m.find(e=>t<=e.c1&&e.c0<=n);if(i)throw new S(`${o} : chevauche la section « ${i.name} »`);m.push({name:r[1],c0:t,c1:n})}else if(r[0]===`scie`)h.push({line:n+e+1,words:r});else throw new S(`${o} : déclaration « ${r[0]} » inconnue (section, scie)`)}for(let{line:e,words:t}of h){let n=`Annexe, ligne ${e}`;if(t.length<7)throw new S(`${n} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);let[,r,i,s,c]=t;if(u.some(e=>e.id===r))throw new S(`${n} : scie « ${r} » déjà déclarée`);let l=i===`o`?b:i===`O`?x:E(i,n);if(l<=0||l>y)throw new S(`${n} : rayon hors bornes (au plus 4 tuiles)`);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>72e3)throw new S(`${n} : cycle en pas attendu (1 à ${v})`);if(c!==`aller-retour`&&c!==`boucle`)throw new S(`${n} : mode « ${c} » inconnu (aller-retour, boucle)`);let d=t.slice(5).map(e=>{let t=/^(\d+),(\d+)$/.exec(e);if(!t)throw new S(`${n} : point « ${e} » (col,rangée) attendu`);let r={col:Number(t[1]),row:Number(t[2])};if(r.col>=a||r.row>=o)throw new S(`${n} : point ${e} hors de la grille`);return r});if(d.length>32)throw new S(`${n} : au plus 32 points`);let f=m.findIndex(e=>d[0].col>=e.c0&&d[0].col<=e.c1);if(f<0)throw new S(`${n} : le premier point (colonne ${d[0].col}) n'est dans aucune section`);let p=d.map(e=>T(e.col,e.row)),h=Number(s);u.push({id:r,radius:l,mode:c,points:p,cycle:h,section:f,...D(p,c,h)})}return{width:a,height:o,tiles:s,start:c[0],finish:l[0],sections:m,saws:u,crumbles:d,crumbleIndex:f,checkpoints:p}}function k(e,t,n){return n>=e.height?0:t<0||n<0||t>=e.width?1:e.tiles[n*e.width+t]}function A(e){return{x:e.col*p,y:e.row*p}}function j(e,t){if(e.cycle===0||t<=0)return e.nodes[0];let n=t%e.cycle,r=e.nodes.length,i=0;for(;i<r-1&&n>=e.times[i+1];)i++;let a=e.nodes[i],o=e.nodes[(i+1)%r],s=e.times[i],c=e.times[i+1]-s;return c<=0?a:{x:a.x+m((o.x-a.x)*(n-s),c),y:a.y+m((o.y-a.y)*(n-s),c)}}var M=12;function N(e){return e>>M}function P(e,t,n,r,i){for(let a=r;a<=i;a++)for(let r=t;r<=n;r++)if(h(k(e,r,a)))return!0;return!1}function ee(e,t,n,r,i){return P(e,N(t),N(t+r-1),N(n),N(n+i-1))}function te(e,t,n,r,i,a,o){if(r===0)return{pos:t,blocked:!1};let s=N(i),c=N(i+a-1),l=t=>o?P(e,t,t,s,c):P(e,s,c,t,t);if(r>0){let e=N(t+n-1)+1,i=N(t+n+r-1);for(let t=e;t<=i;t++)if(l(t))return{pos:t*p-n,blocked:!0}}else{let e=N(t)-1,n=N(t+r);for(let t=e;t>=n;t--)if(l(t))return{pos:(t+1)*p,blocked:!0}}return{pos:t+r,blocked:!1}}var F=3072,I=3072,ne=2048,L=Object.freeze({runSpeed:375,groundAccel:17,groundDecel:32,airAccel:13,airDecel:6,gravity:19,fallSpeed:751,jumpSpeed:800,jumpCut:340,slideSpeed:171,wallJumpX:340,wallJumpY:680,wallLock:0,wallReach:512,coyote:10,wallCoyote:6,jumpBuffer:12,cornerTolerance:1024,crumbleDelay:30,springSpeed:1056}),R=[`sprintMode`,`sprintSpeed`,`sprintDelay`,`sprintAccel`],z=Object.keys(L),B=Object.freeze({sprintMode:1,sprintSpeed:512,sprintDelay:48,sprintAccel:2}),V=Object.freeze({beltSpeed:171,iceAccel:4,iceDecel:4}),re=[`beltSpeed`,`iceAccel`,`iceDecel`];function H(e,t){return e[t]??V[t]}function ie(e){return z.every(t=>e[t]===L[t])&&!e.sprintMode&&re.every(t=>H(e,t)===V[t])}function ae(e){let t=e.sprintSpeed??0;return t<e.runSpeed?e.runSpeed:t>2048?ne:t}function oe(e){let t=e.start.col*p+m(p-F,2),n=(e.start.row+1)*p-I,r=+!!ee(e,t,n+1,3072,3072);return{x:t,y:n,vx:0,vy:0,ground:r,air:r?0:255,wallSide:0,wallAir:255,slide:0,buffer:0,held:0,jumping:0,lock:0,lockDir:0}}function se(e){return e.ground?`sol`:e.slide===0?`air`:`mur`}function ce(e,t,n){let r=N(n+I),i=N(t),a=N(t+F-1),o=k(e,N(t+m(F,2)),r);if(h(o))return o;for(let t=i;t<=a;t++){let n=k(e,t,r);if(h(n))return n}return 0}var le=e=>e>0?1:e<0?-1:0,ue=(e,t,n)=>e<t?t:e>n?n:e,U=(e,t,n)=>e<t?e+n>t?t:e+n:e-n<t?t:e-n;function W(e,t,n,r,i){let a=N(n),o=N(n+I-1),s=r<0?t:t+F,c=r<0?N(t)-1:N(t+F-1)+1,l=N(r<0?t-i-1:t+F+i);for(let t=c;r<0?t>=l:t<=l;t+=r)for(let n=a;n<=o;n++)if(h(k(e,t,n)))return r<0?s-(t+1)*p:t*p-s;return-1}function de(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=r,a=(t&2?1:0)-(t&1?1:0),o=t&4?1:0,s=o===1&&e.held===0;e.lock>0&&a===e.lockDir&&(a=0);let c=e.lock>0?e.lock-1:0,l=c>0?e.lockDir:0,u=e.ground===1,d=u?ce(n,e.x,e.y):0,f=d===8?-1:+(d===9),m=d===10,g=e.carry??0,_=u?m?H(i,`iceAccel`):i.groundAccel:i.airAccel,v=u?m?H(i,`iceDecel`):i.groundDecel:i.airDecel,y=i.sprintMode===1,b=y?e.sprint??0:0,x=e.vx;if(f!==0){let e=a*i.runSpeed+f*H(i,`beltSpeed`),t=le(e);x=t===0?U(x,0,v):U(x,e,x*t<0?_>v?_:v:x*t<e*t?_:v)}else if(g!==0&&!u)a===0?x=x*g>0?x:U(x,0,v):x*a<0?x=U(x,a*i.runSpeed,_>v?_:v):x*a<=i.runSpeed&&(x=U(x,a*i.runSpeed,_));else if(a===0)x=U(x,0,v);else if(x*a<0)x=U(x,a*i.runSpeed,_>v?_:v);else if(y&&b>=(i.sprintDelay??0)&&x*a>=i.runSpeed&&ae(i)>i.runSpeed){let e=ae(i);x*a>e?x=U(x,a*e,v):u&&(x=U(x,a*e,i.sprintAccel??0))}else x=x*a>i.runSpeed?U(x,a*i.runSpeed,v):U(x,a*i.runSpeed,_);let S=e.vy,C=0;!u&&S>=0&&a!==0&&W(n,e.x,e.y,a,1)===0&&(C=a);let w=C===0?i.fallSpeed:i.slideSpeed;S=S<w?S+i.gravity>w?w:S+i.gravity:S-i.gravity<w?w:S-i.gravity;let T=e.air,E=e.wallAir,D=e.jumping,O=!1,A=!1;if(s||e.buffer>0){if(u||e.air<=i.coyote)S=-i.jumpSpeed,O=!0,T=255;else{let t=W(n,e.x,e.y,-1,i.wallReach),r=W(n,e.x,e.y,1,i.wallReach),o=0;t>=0&&r>=0?o=a===0?t<=r?-1:1:a:t>=0?o=-1:r>=0?o=1:e.wallSide!==0&&e.wallAir<=i.wallCoyote&&(o=e.wallSide),o!==0&&(x=-o*i.wallJumpX,S=-i.wallJumpY,O=!0,A=!0,C=0,E=255,c=i.wallLock,l=c>0?o:0)}}O&&(D=1);let j=O?0:s?i.jumpBuffer:e.buffer>0?e.buffer-1:0;D===1&&o===0&&S<-i.jumpCut&&(S=-i.jumpCut,D=0),S>=0&&(D=0),x=ue(x,-2048,ne),S=ue(S,-2048,ne);let M=e.x,P=e.y,L=te(n,M,F,x,P,I,!0);M=L.pos,L.blocked&&(x=0);let R=te(n,P,I,S,M,F,!1);if(R.blocked&&S<0&&i.cornerTolerance>0){let e=N(R.pos)-1,t=N(M),r=N(M+F-1),a=h(k(n,t,e)),o=h(k(n,r,e)),s=M;t!==r&&a&&!o&&(t+1)*4096-M<=i.cornerTolerance?s=(t+1)*p:t!==r&&o&&!a&&M+3072-r*4096<=i.cornerTolerance&&(s=r*p-F),s!==M&&!ee(n,s,P,3072,3072)&&(M=s,R=te(n,P,I,S,M,F,!1))}P=R.pos,R.blocked&&(S<0&&(D=0),S=0);let z=S>=0&&ee(n,M,P+1,3072,3072)?1:0;z?T=0:T<255&&(T+=1);let B=e.wallSide;if(z)B=0,E=255;else{let e=W(n,M,P,-1,1)===0,t=W(n,M,P,1,1)===0;e===t?e&&t?(B=a===0?B:a,E=0):E<255&&(E+=1):(B=e?-1:1,E=0)}z&&(D=0);let V=0;if(z){let e=ce(n,M,P);V=e===8?-1:+(e===9)}else g!==0&&x*g>0&&(V=g);let re=V===0?{}:{carry:V};return y?(a===0||e.vx*a<0||L.blocked||C!==0||A?b=0:u&&(b=x*a===i.runSpeed||b>=(i.sprintDelay??0)&&x*a>i.runSpeed?b<255?b+1:b:0),{x:M,y:P,vx:x+0,vy:S+0,ground:z,air:T,wallSide:B,wallAir:E,slide:C,buffer:j,held:o,jumping:D,lock:c,lockDir:l,sprint:b,...re}):{x:M,y:P,vx:x+0,vy:S+0,ground:z,air:T,wallSide:B,wallAir:E,slide:C,buffer:j,held:o,jumping:D,lock:c,lockDir:l,...re}}var fe=[`aucune`,`pic`,`scie`,`chute`],pe=1024,G=2048;function me(e,t,n){let r=p,i=t*r,a=n*r,o=r-2*pe;switch(e){case 4:return{x:i+pe,y:a+r-G,w:o,h:G};case 5:return{x:i+pe,y:a,w:o,h:G};case 6:return{x:i+r-G,y:a+pe,w:G,h:o};case 7:return{x:i,y:a+pe,w:G,h:o};default:throw RangeError(`spikeBox : la tuile ${e} n'est pas un pic`)}}function he(e,t){return e.x<t.x+t.w&&t.x<e.x+e.w&&e.y<t.y+t.h&&t.y<e.y+e.h}var ge=(e,t,n)=>e<t?t:e>n?n:e;function _e(e,t,n){let r=e-ge(e,n.x,n.x+n.w),i=t-ge(t,n.y,n.y+n.h);return r*r+i*i}function ve(e,t,n,r){return _e(e,t,r)<n*n}function K(e){return{status:0,time:0,player:oe(e),tiles:e.tiles,crumbles:e.crumbles.map(()=>0),sections:e.sections.map(()=>-1),deathCause:0,deathX:0,deathY:0,deathTicks:0,springCell:-1,springTime:0,checkpoint:-1}}function ye(e,t){let n=e.checkpoints[t.checkpoint],r=t.sections.map((t,r)=>e.sections[r].c1>=n.col?-1:t);return{...K(e),status:1,time:t.time,player:oe({...e,start:n}),sections:r,checkpoint:t.checkpoint}}function be(e,t,n){let r=e.saws[n];if(r.section<0)return 0;let i=t.sections[r.section];return i<0?0:t.time-i}function xe(e,t){return e.saws.map((n,r)=>j(n,be(e,t,r)))}function Se(e){return{x:e.x,y:e.y,w:F,h:I}}function Ce(e,t){let n=t.player;if(n.y+3072>e.height*4096)return 3;let r=Se(n),i=N(n.x),a=N(n.x+F-1),o=N(n.y)<0?0:N(n.y),s=N(n.y+I-1);for(let t=o;t<=s;t++)for(let n=i;n<=a;n++){if(n<0||n>=e.width)continue;let i=e.tiles[t*e.width+n];if(g(i)&&he(r,me(i,n,t)))return 1}for(let n=0;n<e.saws.length;n++){let i=e.saws[n],a=j(i,be(e,t,n));if(ve(a.x,a.y,i.radius,r))return 2}return 0}function we(e,t){let n=p;return he(Se(t),{x:e.finish.col*n,y:e.finish.row*n,w:n,h:n})}function Te(e,t){return t===e.tiles?e:{width:e.width,height:e.height,tiles:t}}function Ee(e,t,n){return t<0||n<0||t>=e.width||n>=e.height?-1:n*e.width+t}function q(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=t&4?1:0;if(e.status===3)return e;if(e.status===2){let t=e.deathTicks+1,r=e.checkpoint>=0?e.time+1:e.time;if(t<18)return{...e,deathTicks:t,time:r};if(e.checkpoint>=0){let t=ye(n,{...e,time:r});return i&&(t.player={...t.player,held:1}),t}let a=K(n);return i&&(a.player={...a.player,held:1}),a}if(e.status===0){let n=t&3;if(!(n===1||n===2||i===1&&e.player.held===0))return e.player.held===i?e:{...e,player:{...e.player,held:i}}}let a=p,o=e.tiles,s=e.crumbles;for(let t=0;t<s.length;t++){let r=s[t];if(!(r<=0)&&(s===e.crumbles&&(s=[...s]),s[t]=r>1?r-1:-1,r===1)){o===e.tiles&&(o=[...o]);let r=n.crumbles[t];o[r.row*n.width+r.col]=0}}let c=de(e.player,t,Te(n,o),r),l=c.ground===1,u=N(c.x),d=N(c.x+F-1),f=e.springCell,h=e.springTime;if(l&&r.springSpeed>0){let t=N(c.y+I),i=N(c.x+m(F,2)),a=-1;for(let e of[i,u,d]){let r=Ee(n,e,t);if(r>=0&&o[r]===3){a=r;break}}if(a>=0){let t=r.springSpeed<2048?r.springSpeed:ne;c={...c,vy:-t,ground:0,air:255,jumping:0,buffer:0},f=a,h=e.time+1}}let g=(t,i)=>{let a=Ee(n,t,i);if(a<0)return;let o=n.crumbleIndex[a];o<0||s[o]!==0||(s===e.crumbles&&(s=[...s]),s[o]=r.crumbleDelay>1?r.crumbleDelay:1)};if(l){let e=N(c.y+I);for(let t=u;t<=d;t++)g(t,e)}else{let e=(t&2?1:0)-(t&1?1:0),n=N(c.y),r=N(c.y+I-1);if(e>0&&(c.x+3072)%a===0)for(let e=n;e<=r;e++)g(N(c.x+F),e);if(e<0&&c.x%a===0)for(let e=n;e<=r;e++)g(N(c.x)-1,e)}let _=e.time+1,v=e.sections,y=N(c.x+m(F,2));for(let t=0;t<v.length;t++){let r=n.sections[t];v[t]>=0||y<r.c0||y>r.c1||(v===e.sections&&(v=[...v]),v[t]=_)}let b={...e,status:1,time:_,player:c,tiles:o,crumbles:s,sections:v,springCell:f,springTime:h};if(we(n,c))return{...b,status:3};let x=Ce(n,b);if(x!==0)return{...b,status:2,deathCause:x,deathX:c.x+m(F,2),deathY:c.y+m(I,2),deathTicks:0};let S=N(e.player.x+m(F,2));if(y>S){let e=b.checkpoint;for(let t=0;t<n.checkpoints.length;t++){let r=n.checkpoints[t].col;S<r&&r<=y&&(e=t)}if(e!==b.checkpoint)return{...b,checkpoint:e}}return b}var De=O(`
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
`);Object.freeze({floorRow:26,start:3,steps:[[33,1],[38,2],[43,3],[48,4]],coyoteLedge:57,gaps:[[75,2],[81,3],[88,4],[96,5],[105,6]],lowGaps:[[115,4,23],[124,3,24]],corridor:[133,10],chimneys:[[149,3],[154,2]],chimneyTopRow:16,wall:[163,12],slab:[171,18],slabHoles:[175,180,181,186],finish:193});var Oe=O(`
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
`),ke=O(`
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
`),J=72e3,Ae=/^[a-z0-9_:-]{1,40}$/,je=256,Me=4096,Ne=1,Pe=2,Fe=4,Y=class extends Error{code;constructor(e,t){super(t),this.code=e,this.name=`JumpReplayError`}},Ie=Object.freeze({checkpoint:-1,held:0,time:0,sections:Object.freeze([]),elan:0});function Le(e){let t=0;for(let n of e)t+=n.count;return t}function Re(e){let t=[];for(let n of e){let e=t[t.length-1];e&&e.bits===n?e.count++:t.push({count:1,bits:n})}return t}function ze(e){let t=[];for(let n of e)for(let e=0;e<n.count;e++)t.push(n.bits);return t}function Be(e){if(!Ae.test(e))throw new Y(`format`,`Identifiant de niveau invalide : « ${e} »`)}function Ve(e){Be(e.levelId);let t=e.start,n=[1];d(n,e.simVersion),n.push(e.levelId.length);for(let t=0;t<e.levelId.length;t++)n.push(e.levelId.charCodeAt(t));let r=t.checkpoint>=0;if(r&&t.elan)throw new Y(`format`,`Départ lancé sur un point de passage`);if(n.push((t.held?Ne:0)|(r?Pe:0)|(t.elan?Fe:0)),r){d(n,t.checkpoint),d(n,t.time),d(n,t.sections.length);for(let e of t.sections)d(n,e+1)}let i=0;for(let t of e.runs){if(!Number.isInteger(t.count)||t.count<1)throw new Y(`format`,`Série vide`);if(!Number.isInteger(t.bits)||t.bits<0||t.bits>7)throw new Y(`format`,`Commande invalide : ${t.bits}`);if(i+=t.count,i>J)throw new Y(`length`,`Rediffusion trop longue (plus de ${J} pas)`);d(n,t.count*8+t.bits)}return l(n)}function He(e){if(typeof e!=`string`||e.length===0)throw new Y(`format`,`Rediffusion vide`);let t;try{t=u(e)}catch(e){throw e instanceof s?new Y(`format`,`Rediffusion illisible (${e.message})`):e}let n=0,r=()=>{let e=t[n++];if(e===void 0)throw new Y(`format`,`Rediffusion tronquée`);return e},i=e=>{try{return f(r)}catch(t){throw t instanceof s?new Y(`format`,`${e} : entier trop long`):t}},a=r();if(a!==1)throw new Y(`format`,`Format de rediffusion inconnu (${a})`);let o=i(`Version`),c=r(),l=``;for(let e=0;e<c;e++)l+=String.fromCharCode(r());Be(l);let d=r();if(d&-8)throw new Y(`format`,`Drapeaux de départ inconnus`);if(d&Pe&&d&Fe)throw new Y(`format`,`Départ lancé sur un point de passage`);let p={checkpoint:-1,held:d&Ne?1:0,time:0,sections:[],elan:d&Fe?1:0};if(d&Pe){let e=i(`Point de passage`),t=i(`Chrono`),n=i(`Sections`);if(e>=Me)throw new Y(`format`,`Point de passage hors limites`);if(t>J)throw new Y(`length`,`Chrono de départ trop long`);if(n>je)throw new Y(`format`,`Trop de sections`);let r=[];for(let e=0;e<n;e++){let e=i(`Section`)-1;if(e>t)throw new Y(`format`,`Section mise en marche après le départ`);r.push(e)}p.checkpoint=e,p.time=t,p.sections=r}let h=[],g=0;for(;n<t.length;){let e=i(`Série`),t=e%8,n=m(e-t,8);if(n<1)throw new Y(`format`,`Série vide`);if(g+=n,g>J)throw new Y(`length`,`Rediffusion trop longue (plus de ${J} pas)`);h.push({count:n,bits:t})}return{simVersion:o,levelId:l,start:p,runs:h}}function Ue(e,t){if(t.checkpoint<0){let n=K(e);return!t.held&&!t.elan?n:{...n,player:{...n.player,held:+!!t.held,vx:t.elan?L.runSpeed:0}}}if(t.elan)throw new Y(`format`,`Départ lancé sur un point de passage`);if(t.checkpoint>=e.checkpoints.length)throw new Y(`level`,`Point de passage ${t.checkpoint} absent de ce niveau`);if(t.sections.length!==e.sections.length)throw new Y(`level`,`Nombre de sections différent de celui du niveau`);let n=ye(e,{...K(e),checkpoint:t.checkpoint,time:t.time,sections:t.sections});return t.held?{...n,player:{...n.player,held:1}}:n}function We(e){return{checkpoint:e.checkpoint,held:e.player.held,time:e.time,sections:[...e.sections],elan:0}}function Ge(e,t,n){if(t.simVersion!==3)throw new Y(`version`,`Rediffusion d'une autre version de la simulation (${t.simVersion}, actuelle 3)`);if(n!==void 0&&t.levelId!==n)throw new Y(`level`,`Rediffusion d'un autre niveau (« ${t.levelId} »)`);if(Le(t.runs)>J)throw new Y(`length`,`Rediffusion trop longue (plus de ${J} pas)`);return Ue(e,t.start)}function Ke(e,t){return t.status===3||t.status===2&&e.status!==2&&t.checkpoint<0}function qe(e,t,n){let r=Ge(e,t,n),i=[],a=[],o={start:{...t.start,sections:[...t.start.sections]},startTick:0,runs:[],ticks:0},s=0,c=!1;for(let n of t.runs)for(let t=0;t<n.count;t++){if(c)throw new Y(`format`,`Pas après la fin de l'essai (pas ${s+1})`);let t=r;if(r=q(t,n.bits,e,L),s++,o){let e=o.runs[o.runs.length-1];e&&e.bits===n.bits?e.count++:o.runs.push({count:1,bits:n.bits}),o.ticks++}if(r.status===2&&t.status!==2){let e={cause:r.deathCause,x:r.deathX,y:r.deathY};i.push({tick:s,time:r.time,...e,life:a.length}),o&&a.push({index:a.length,...o,end:`mort`,death:e}),o=null}else r.status===1&&t.status===2?o={start:We(r),startTick:s,runs:[],ticks:0}:r.status===3&&t.status!==3&&o&&(a.push({index:a.length,...o,end:`arrivée`,death:null}),o=null);Ke(t,r)&&(c=!0)}return o&&o.ticks>0&&a.push({index:a.length,...o,end:`abandon`,death:null}),{finished:r.status===3,ticks:s,time:r.time,deaths:i,lives:a,final:r}}function Je(e,t){return{simVersion:e.simVersion,levelId:e.levelId,start:t.start,runs:t.runs.map(e=>({...e}))}}var Ye=class{level;replay;state;prev;tick=0;total;run=0;left;constructor(e,t){this.level=e,this.replay=t,this.state=Ge(e,t),this.prev=this.state,this.total=Le(t.runs),this.left=t.runs[0]?.count??0}get done(){return this.tick>=this.total}next(){let e=this.replay.runs[this.run];return e?(this.left--,this.left===0&&(this.run++,this.left=this.replay.runs[this.run]?.count??0),e.bits):0}step(){return this.done?(this.prev=this.state,!1):(this.prev=this.state,this.state=q(this.state,this.next(),this.level,L),this.tick++,!0)}},Xe=class{levelId;inputs=[];count=0;held=0;active=!1;skipping=!1;constructor(e){this.levelId=e,Be(e)}get recording(){return this.active}get ticks(){return this.count}step(e,t,n){if(this.skipping){if(n.status!==0)return null;this.skipping=!1}if(!this.active){if(e.status!==0||n.status===0)return null;this.active=!0,this.inputs=[],this.count=0,this.held=e.player.held}if(this.count>=J)return this.active=!1,this.skipping=!0,this.inputs=[],this.count=0,null;let r=this.inputs[this.inputs.length-1];return r&&r.bits===t?r.count++:this.inputs.push({count:1,bits:t}),this.count++,n.status===3?this.close(`arrivée`):Ke(e,n)?this.close(`mort`):null}abandon(){return this.skipping=!1,!this.active||this.count===0?(this.active=!1,null):this.close(`abandon`)}peek(){return!this.active||this.count===0?null:this.replayOf()}replayOf(){return{simVersion:3,levelId:this.levelId,start:{...Ie,held:this.held},runs:this.inputs.map(e=>({...e}))}}close(e){let t=this.replayOf();return this.active=!1,this.inputs=[],this.count=0,{replay:t,end:e}}};function Ze(e,t){return Math.imul(e^(t|0),16777619)>>>0}function Qe(e,t){let n=new Ye(e,t),r=2166136261,i=0;for(;n.step();){let e=n.state,t=e.player;for(let e of[t.x,t.y,t.vx,t.vy,t.ground,t.air,t.wallSide,t.wallAir,t.slide,t.buffer,t.held,t.jumping,t.lock,t.lockDir])r=Ze(r,e);for(let t of[e.status,e.time,e.deathCause,e.deathX,e.deathY,e.deathTicks,e.springCell,e.springTime,e.checkpoint])r=Ze(r,t);for(let t of e.crumbles)r=Ze(r,t);for(let t of e.sections)r=Ze(r,t);e.status===2&&n.prev.status!==2&&i++}return{hash:r.toString(16).padStart(8,`0`),finished:n.state.status===3,ticks:n.tick,time:n.state.time,deaths:i}}var $e=480,et=e=>N(e.player.x+m(F,2));function tt(e,t){let n=ze(t.runs),r=[],i=e.checkpoints.map(()=>-1),a=Ue(e,t.start);for(let t=0;t<n.length;t++)a=q(a,n[t],e,L),a.checkpoint>=0&&i[a.checkpoint]===-1&&(i[a.checkpoint]=t+1,r[a.checkpoint]=a);return{inputs:n,resume:i.map((t,i)=>{if(t<0)return-1;let a=ye(e,r[i]),o=t,s=-1;for(let r=t-120<0?0:t-120;r<=t+30&&r<n.length;r+=2){let t=a,i=et(t);for(let a=0;a<360&&r+a<n.length&&(t=q(t,n[r+a],e,L),t.status===1);a++){let e=et(t);e>i&&(i=e)}t.status===3&&(i+=1e4),i>s&&(s=i,o=r)}return o})}}function nt(t,n,r,i){let a=new e(r),o=tt(t,n),s=i.maxLives??6,c=Ue(t,n.start),l=[],u=(e,t)=>{let n=e+a.int(t);return[n,n+4+a.int(37),a.int(8)]};for(let e=0;e<i.attempts;e++){let e=[u(0,a.chance(50)?m(o.inputs.length,3):o.inputs.length)],r=new Xe(n.levelId),i=c,d=0,f=1,p=et(i),h=0,g=null;for(;;){let n=o.inputs[d]??0;for(let[t,r,i]of e)d>=t&&d<r&&(n=i);let c=i;if(i=q(c,n,t,L),g=r.step(c,n,i),g)break;d++;let l=et(i);if(l>p)p=l,h=0;else if(++h>$e){g=r.abandon();break}if(i.status===1&&c.status===2){if(++f>s){g=r.abandon();break}d=o.resume[i.checkpoint]??0,d<0&&(d=0),h=0,p=et(i),a.chance(70)&&e.push(u(d,360))}}g&&l.push(g)}return l}var rt=[`foret`,`usine`,`glace`,`nuit`,`neon`],it={usine:`tapis`,glace:`glace`},at=[`usine`,`glace`];function ot(e){return it[e]??null}var st=120,ct=1953000761,lt=(n,r)=>new e(t(n,ct)).int(r);function ut(e){let t=e=>rt[lt(e,rt.length)];if((e%2+2)%2==0)return t(e);let n=new Set([t(e-1),t(e+1)]),r=rt.filter(e=>!n.has(e));return r[lt(e,r.length)]}var dt=`id: ascenseur
intention: Franchir deux fossés où des scies montent et descendent à contretemps : sauter chaque fois qu'elle est en bas.
etiquettes: scie
famille: trou-scie
mutateurs: sol-friable fosse denivele
format: 3
paliers: 10 10
repeter: trou colonnes 3-3
repeter: trou colonnes 10-10
variante: trou=1 cycle=240
variante: trou=1 cycle=180
variante: trou=2 cycle=240
variante: trou=1 cycle=240 +sol-friable
variante: trou=2 cycle=200 +fosse
variante: trou=1 cycle=180 +denivele:2
grille:
...............
...............
...............
...............
...............
...............
...............
...............
...............
...............
##...####...###
##...####...###
##...####...###
##...####...###
##...####...###

scie montee o {cycle} aller-retour 3,12 3,3
scie descente o {cycle} aller-retour 10,3 10,12
zone sol-friable 5-8 10
zone fosse 2-4 13
zone fosse 9-11 13
zone denivele 12-14
(id: cheminee-pics
intention: Monter une cheminée dont chaque mur porte une plaque de pics : choisir le bon mur à chaque hauteur, puis redescendre.
etiquettes: mural precision vertical
famille: cheminee
mutateurs: garde denivele
format: 3
paliers: 17 10
repeter: plaque rangees 13-13
repeter: plaque rangees 8-8
variante: plaque=2
variante: plaque=1
variante: plaque=1 +denivele:3
grille:
###...........
###...........
###...........
###...........
###...........
###...........
###...####....
###>..####....
###>..####....
###...####....
###...########
###...########
###..<########
.##..<########
.##...########
......########
......########
##############
##############
##############

zone garde 3 10-11 >
zone denivele 10-13
(id: cheminee-quinconce
intention: Monter une cheminée d'un mur à l'autre, puis traverser en haut un couloir de scies en quinconce et sauter ses deux fosses sans casser son rythme.
etiquettes: mural scie vertical precision
famille: cheminee
enchainement: long
mutateurs: sol-friable fosse
format: 3
paliers: 23 8
repeter: haut rangees 12-12
repeter: ecart colonnes 12-12
repeter: ecart colonnes 18-18
variante: haut=4 ecart=2
variante: haut=4 ecart=2 +sol-friable
variante: haut=4 ecart=2 +fosse
grille:
###.....################...................
###.....################...................
###.....################...................
###........................................
###........................................
###.............o..........................
###........................................
###.......o...........o.........o..........
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
###..#####################...#######...####
.##..#####################...#######...####
.##..#####################...#######...####
.....#####################^^^#######^^^####
.....#####################...#######...####
###########################################
###########################################
###########################################

zone sol-friable 11-15 8
zone fosse 26-28 21
zone fosse 36-38 21
(id: cheminee-scie
intention: Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment.
etiquettes: mural scie vertical
famille: cheminee
mutateurs: patrouille denivele
format: 3
paliers: 17 6
repeter: haut rangees 10-10
variante: haut=2 cycle=540
variante: haut=2 cycle=600
variante: haut=2 cycle=660
variante: haut=2 cycle=600 +denivele:3
grille:
###..........
###..........
###..........
###..........
###..........
###..........
###...###.###
###...###.###
###...###.###
###...###.###
###...###.###
###...###.###
###...###.###
.##...#######
.##...#######
......#######
......#######
#############
#############
#############

scie va-et-vient o {cycle} aller-retour 4,2 4,8
zone patrouille o 300 aller-retour 8,4 12,4
zone denivele 10-12
(id: cheminee-vide
intention: S'élancer dans une cheminée sans fond au-dessus des pics, et la remonter d'un mur à l'autre sans jamais retomber.
etiquettes: mural vertical
famille: entre-murs
mutateurs: garde fosse denivele
format: 3
paliers: 15 4
repeter: large colonnes 4-4
repeter: haut rangees 8-8
variante: large=1 haut=1
variante: large=1 haut=2 +garde
variante: large=1 haut=2
variante: large=1 haut=1 +garde
variante: large=2 haut=1 +fosse
grille:
.........
.........
.........
.........
..#..####
..#..####
..#..####
..#..####
..#..####
..#..####
..#..####
.....####
.....####
.....####
.....####
##...####
##...####
##...####
##...####
##^^^####
#########

zone garde 4 12-13 <
zone fosse 2-4 19
zone denivele 5-8
(id: cheminee
intention: Monter une cheminée en sautant d'un mur à l'autre, puis sortir par le haut et franchir le trou du sommet.
etiquettes: mural vertical
famille: cheminee
mutateurs: plafond fosse denivele
format: 3
paliers: 17 7
repeter: large colonnes 4-4
repeter: haut rangees 10-10
variante: large=2 haut=2
variante: large=2 haut=4
variante: large=2 haut=4 +fosse +denivele:3
grille:
###...........
###...........
###...........
###...........
###...........
###...........
###..###......
###..###...###
###..###...###
###..###...###
###..###...###
###..###...###
###..###...###
.##..###...###
.##..###...###
.....###...###
.....###...###
########...###
########...###
########...###

zone plafond 6-13 2
zone fosse 8-10 16
zone denivele 11-13
(id: chute-pics
intention: Tomber au fond d'un puits étroit en esquivant les pics des parois, à gauche puis à droite.
etiquettes: precision vertical
famille: chute
mutateurs: patrouille garde denivele
format: 3
paliers: 4 25
repeter: prof rangees 12-12
variante: prof=1
variante: prof=3
variante: prof=1 +patrouille
variante: prof=2 +garde
variante: prof=1 +denivele:2
grille:
...........
...........
...........
...........
###....####
###....####
###....####
###....####
###>...####
###>...####
###....####
###....####
###....####
###...<####
###...<####
###....####
###>...####
###>...####
###....####
###........
###........
###........
###........
#######....
###########
###########

zone patrouille o 150 aller-retour 3,11 6,11
zone garde 6 5-6 <
zone denivele 7-10
(id: corniches
intention: Suivre une vague de corniches, un petit bond pour chacune, en montant puis en redescendant plus bas qu'au départ.
etiquettes: respiration
famille: corniches
mutateurs: sol-friable denivele
format: 3
paliers: 10 12
repeter: large colonnes 5-5
repeter: large colonnes 9-9
repeter: large colonnes 13-13
repeter: large colonnes 17-17
repeter: large colonnes 21-21
variante: large=1
variante: large=2
variante: large=1 +sol-friable
variante: large=2 +denivele:2
grille:
......................
......................
......................
......................
......................
......................
........###...........
........###...........
....###.###.###.......
....###.###.###.......
###.###.###.###.###...
###.###.###.###.###...
###.###.###.###.###.##
###.###.###.###.###.##
###.###.###.###.###.##
###.###.###.###.###.##

zone sol-friable 8-10 6
zone denivele 20-21
(id: demi-tour-ressorts
intention: Prendre un court appel, enchaîner les ressorts au-dessus d'une fosse à pics, puis rebondir en arrière contre un mur hérissé pour le franchir.
etiquettes: mural ressort precision
famille: demi-tour
enchainement: long
mutateurs: sol-friable plafond denivele
format: 3
paliers: 9 11
repeter: ecart colonnes 49-49
variante: ecart=0 +denivele:1
variante: ecart=0
variante: ecart=0 +sol-friable
grille:
........................................................
........................................................
........................................................
........................................................
........................................................
........................................................
........................................................
........................................................
........................................................
####***^^^^^^^^***^^^^^^^^***^^^^^^^^***^^^.............
###########################################.............
###########################################.........####
###########################################........<####
###########################################.###....<####
###########################################........<####
###########################################........<####
###########################################.........####
###########################################......^^.####
########################################################
########################################################

zone sol-friable 44-46 13
zone plafond 2-42 1
zone denivele 52-55
(id: demi-tour
intention: Sauter contre le bas d'un mur hérissé, rebondir en arrière sur une corniche, puis repartir par-dessus le mur.
etiquettes: mural
famille: demi-tour
mutateurs: sol-friable plafond denivele
format: 3
paliers: 15 8
repeter: ecart colonnes 6-6
variante: ecart=1
variante: ecart=2
variante: ecart=4
variante: ecart=2 +sol-friable
variante: ecart=1 +plafond
variante: ecart=2 +denivele:-2
grille:
.............
.............
.............
.............
.............
.............
.............
.............
.........####
........<####
..###...<####
........<####
.........####
.........####
......^^^####
#############
#############

zone sol-friable 2-4 10
zone plafond 0-7 5
zone denivele 9-12
(id: descente-scies
intention: Dévaler des corniches de plus en plus basses pendant que des scies montent et descendent entre elles.
etiquettes: scie vertical precision
famille: descente
enchainement: long
mutateurs: fosse sol-friable denivele
format: 3
paliers: 4 22
variante: cycle=240
variante: cycle=180
variante: cycle=300
variante: cycle=200 +fosse
variante: cycle=180 +sol-friable
variante: cycle=240 +denivele:2
grille:
.........................................................
.........................................................
.........................................................
.........................................................
###......................................................
###......................................................
###...###................................................
###...###................................................
###...###...###..........................................
###...###...###..........................................
###...###...###...###....................................
###...###...###...###....................................
###...###...###...###...###..............................
###...###...###...###...###..............................
###...###...###...###...###...###........................
###...###...###...###...###...###........................
###...###...###...###...###...###...###..................
###...###...###...###...###...###...###..................
###...###...###...###...###...###...###...###............
###...###...###...###...###...###...###...###............
###...###...###...###...###...###...###...###...###......
###...###...###...###...###...###...###...###...###......
###...###...###...###...###...###...###...###...###...###
###...###...###...###...###...###...###...###...###...###
###...###...###...###...###...###...###...###...###...###

scie premiere o {cycle} aller-retour 10,2 10,12
scie seconde o {cycle} aller-retour 22,18 22,6
scie troisieme o {cycle} aller-retour 34,8 34,18
scie quatrieme o {cycle} aller-retour 46,22 46,10
zone fosse 3-5 24
zone fosse 15-17 24
zone sol-friable 12-14 8
zone sol-friable 30-32 14
zone denivele 54-56
(id: descente
intention: Se laisser tomber de corniche en corniche jusqu'en bas, sans freiner.
etiquettes: respiration
famille: descente
mutateurs: denivele
format: 3
paliers: 4 16
repeter: large colonnes 4-4
repeter: large colonnes 7-7
repeter: large colonnes 10-10
repeter: large colonnes 13-13
repeter: large colonnes 16-16
variante: large=1
variante: large=2
variante: large=3
variante: large=2 +denivele:3
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

zone denivele 17-19
(id: escalier-friable
intention: Gravir un escalier de blocs friables suspendu au-dessus du vide, d'une seule traite.
etiquettes: friable vertical
famille: escalier
mutateurs: patrouille denivele
format: 3
paliers: 17 7
repeter: large colonnes 5-5
repeter: large colonnes 9-9
repeter: large colonnes 13-13
repeter: large colonnes 17-17
variante: large=2
variante: large=2 +patrouille
variante: large=2 +denivele:2
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

zone patrouille o 240 aller-retour 10,3 18,3
zone denivele 20-23
(id: escalier-scies
intention: Gravir un long escalier pendant que des scies roulent d'un bout à l'autre des marches : passer derrière chacune.
etiquettes: scie vertical
famille: escalier
enchainement: long
mutateurs: sol-friable plafond
format: 3
paliers: 22 4
variante: cycle=300
variante: cycle=330
variante: cycle=270
variante: cycle=300 +plafond
grille:
............................................................
............................................................
............................................................
............................................................
......................................................######
......................................................######
................................................############
................................................############
..........................................##################
..........................................##################
....................................########################
....................................########################
..............................##############################
..............................##############################
........................####################################
........................####################################
..................##########################################
..................##########################################
............################################################
............################################################
......######################################################
......######################################################
############################################################
############################################################
############################################################

scie marche0 o {cycle} aller-retour 13,17 16,17
scie marche1 o {cycle} aller-retour 28,13 25,13
scie marche2 o {cycle} aller-retour 37,9 40,9
scie marche3 o {cycle} aller-retour 52,5 49,5
zone sol-friable 18-23 16
zone sol-friable 42-47 12
zone plafond 12-53 1
(id: escalier
intention: Gravir un escalier de grandes marches, un bond par marche, sans casser son élan.
etiquettes: respiration vertical
famille: escalier
mutateurs: sol-friable ressort denivele
format: 3
paliers: 14 4
repeter: large colonnes 4-4
repeter: large colonnes 7-7
repeter: large colonnes 10-10
repeter: large colonnes 13-13
repeter: large colonnes 16-16
variante: large=1
variante: large=1 +sol-friable
variante: large=3 +ressort
variante: large=1 +ressort
variante: large=1 +denivele:2
grille:
...................
...................
...................
...................
................###
................###
.............######
.............######
..........#########
..........#########
.......############
.......############
....###############
....###############
###################
###################

zone sol-friable 7-9 10
zone ressort 7 10
zone denivele 16-18
(id: glace-cheminee
intention: Monter une cheminée en sautant d'un mur à l'autre, puis franchir le trou du sommet pour se poser sur une corniche de glace : on la quitte aussi vite qu'on y arrive.
etiquettes: glace mural vertical
famille: glace-cheminee
theme: glace
mutateurs: plafond fosse denivele
format: 3
paliers: 17 7
repeter: large colonnes 4-4
repeter: haut rangees 10-10
variante: large=2 haut=2
variante: large=2 haut=4
variante: large=2 haut=4 +fosse +denivele:3
grille:
###...........
###...........
###...........
###...........
###...........
###...........
###..###......
###..###...~~~
###..###...###
###..###...###
###..###...###
###..###...###
###..###...###
.##..###...###
.##..###...###
.....###...###
.....###...###
########...###
########...###
########...###

zone plafond 6-13 2
zone fosse 8-10 16
zone denivele 11-13
(id: glace-corniches
intention: Dévaler des corniches glacées dont chacune porte un pic là où l'on glisse : l'élan emporte, il faut sauter au bon endroit.
etiquettes: glace precision
famille: glace-corniches
theme: glace
mutateurs: denivele
format: 3
paliers: 5 11
repeter: fin colonnes 15-15
variante: fin=1
variante: fin=2
variante: fin=3
variante: fin=2 +denivele:2
grille:
................
................
................
................
................
~~~~............
####.^..........
####~~~~........
########.^......
########~~~~....
############....
############~~~~
################
################

zone denivele 14-15
(id: glace-freinage
intention: Se poser sur une petite plaque de glace au-delà d'un trou, sans glisser jusque dans les pics : retenir son élan en l'air, puis repartir.
etiquettes: glace precision
famille: glace-freinage
theme: glace
mutateurs: plafond denivele
format: 3
paliers: 9 9
repeter: trou colonnes 6-6
repeter: pad colonnes 8-8
repeter: fosse colonnes 10-10
variante: trou=4 pad=2 fosse=2
variante: trou=3 pad=1 fosse=3
variante: trou=5 pad=2 fosse=3
variante: trou=4 pad=1 fosse=2 +denivele:2
variante: trou=4 pad=2 fosse=2 +plafond:pics
grille:
...............
...............
...............
...............
...............
...............
...............
...............
...............
######.~~^^^^##
######.########
######.########

zone denivele 13-14
zone plafond 7-12 6
(id: glace-mur
intention: Foncer sur la glace jusqu'au pied d'un grand mur sans pouvoir s'arrêter, puis le remonter saut mural après saut mural.
etiquettes: glace mural vertical
famille: glace-mur
theme: glace
mutateurs: denivele
format: 3
paliers: 14 7
repeter: haut rangees 10-10
repeter: long colonnes 3-3
variante: haut=1 long=1
variante: haut=2 long=2
variante: haut=3 long=1
variante: haut=1 long=3 +denivele:2
grille:
..............
..............
..............
..............
..............
..............
..............
........######
........######
........######
........######
........######
........######
........######
~~~~~~~~######
##############
##############
##############

zone denivele 11-13
(id: glace-promenade
intention: Glisser sur une longue piste de glace en sautant de petites marches : l'élan se garde tout seul, il suffit de sauter à temps.
etiquettes: glace respiration
famille: glace-promenade
theme: glace
mutateurs: denivele
format: 3
paliers: 9 9
repeter: suite colonnes 0-6
variante: suite=5
variante: suite=3
variante: suite=4
variante: suite=3 +denivele:2
grille:
.........
.........
.........
.........
.........
.........
.........
.........
.....#...
~~~~~~~~~
#########
#########

zone denivele 7-8
(id: glace-relais
intention: Dévaler des corniches de glace, se poser sur une plaque avant les pics, puis foncer sur la glace jusqu'à un grand mur à remonter.
etiquettes: glace precision mural
famille: glace-relais
enchainement: long
theme: glace
format: 3
paliers: 7 4
repeter: trou colonnes 16-16
repeter: pad colonnes 18-18
repeter: fosse colonnes 20-20
variante: trou=4 pad=2 fosse=2
variante: trou=3 pad=1 fosse=3
variante: trou=5 pad=2 fosse=3
grille:
....................................
....................................
....................................
....................................
..............................######
..............................######
..............................######
~~~~..........................######
####.^........................######
####~~~~......................######
########.^....................######
########~~~~..................######
############..................######
############~~~~.~~^^^^~~~~~~~######
################.###################
################.###################
################.###################
################.###################
################.###################
################.###################
(id: glace-saut-haut
intention: Courir sur la glace pour prendre tout son élan, puis franchir un trou jusqu'à une corniche plus haute : l'élan ne se rattrape pas.
etiquettes: glace precision
famille: glace-saut-haut
theme: glace
mutateurs: plafond denivele
format: 3
paliers: 11 9
repeter: long colonnes 5-5
repeter: trou colonnes 10-10
variante: long=1 trou=3
variante: long=2 trou=4
variante: long=1 trou=5
variante: long=3 trou=4 +denivele:2
variante: long=2 trou=4 +plafond:pics
grille:
..............
..............
..............
..............
..............
..............
..............
..............
..............
...........###
...........###
~~~~~~~~~~.###
##########.###
##########.###

zone denivele 11-13
zone plafond 10-13 5
(id: grande-scie
intention: Sauter deux trous sous deux grandes scies : un petit saut passe, un grand s'y jette.
etiquettes: scie precision
famille: trou-scie
mutateurs: fosse plafond denivele
format: 3
paliers: 10 10
repeter: trou colonnes 2-2
repeter: trou colonnes 9-9
variante: trou=1
variante: trou=2
variante: trou=1 +fosse
variante: trou=2 +fosse
variante: trou=1 +plafond:pics
variante: trou=2 +denivele:2
grille:
...............
...............
...............
...............
...............
...............
...O......O....
...............
...............
...............
##...####...###
##...####...###
##...####...###

zone fosse 2-4 12
zone fosse 9-11 12
zone plafond 5-8 4
zone denivele 12-14
(id: iles-friables
intention: Sauter d'îlot friable en îlot friable, chacun un peu plus haut, sans jamais s'y poser longtemps.
etiquettes: friable precision
famille: iles
mutateurs: plafond fosse denivele
format: 3
paliers: 12 7
repeter: ecart colonnes 4-4
repeter: ecart colonnes 9-9
repeter: ecart colonnes 14-14
repeter: ecart colonnes 19-19
repeter: ecart colonnes 22-22
variante: ecart=1
variante: ecart=2
variante: ecart=1 +plafond:pics
variante: ecart=2 +fosse
variante: ecart=1 +denivele:3
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
###....................#

zone plafond 4-21 3
zone fosse 3-22 15
zone denivele 23-23
(id: iles-scie
intention: Sauter d'îlot friable en îlot friable sous une scie qui fait le pendule au-dessus d'eux.
etiquettes: friable scie precision
famille: iles
mutateurs: fosse plafond denivele
format: 3
paliers: 9 9
repeter: ecart colonnes 6-6
repeter: ecart colonnes 11-11
repeter: ecart colonnes 16-16
variante: ecart=1 cycle=240
variante: ecart=2 cycle=300
variante: ecart=1 cycle=180
variante: ecart=2 cycle=240 +fosse
variante: ecart=1 cycle=240 +plafond
variante: ecart=1 cycle=300 +denivele:2
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
##..xx...xx...xx...###
##.................###
##.................###
##.................###

scie pendule o {cycle} aller-retour 4,5 16,5
zone fosse 2-18 12
zone plafond 2-18 2
zone denivele 19-21
(id: lucarne
intention: Passer d'un saut par les fenêtres de trois murs minces, chacune à une autre hauteur.
etiquettes: precision
famille: lucarne
mutateurs: sol-friable garde denivele
format: 3
paliers: 10 10
repeter: fenetre rangees 6-6
variante: fenetre=3
variante: fenetre=2
variante: fenetre=3 +denivele:2
grille:
...#.....#.....#....
...#.....#.....#....
...#.....#.....#....
...#.....#.....#....
...#.....#..........
...#................
....................
.........#.....#....
...#.....#.....#....
...#.....#.....#....
####################
####################

zone sol-friable 4-8 10
zone garde 4-8 9 ^
zone denivele 16-19
(id: marelle
intention: Sauter de dalle en dalle, une haute, une basse, au-dessus d'un sol hérissé.
etiquettes: precision
famille: marelle
mutateurs: sol-friable plafond denivele
format: 3
paliers: 9 9
repeter: ecart colonnes 7-7
repeter: ecart colonnes 12-12
repeter: ecart colonnes 17-17
variante: ecart=1
variante: ecart=2
variante: ecart=1 +sol-friable
variante: ecart=2 +plafond:pics
variante: ecart=1 +denivele:2
grille:
.........................
.........................
.........................
.........................
.........................
.........................
.........................
.........###.......###...
.........................
###.###.......###.....###
###...................###
###...................###
###^^^^^^^^^^^^^^^^^^^###
#########################
#########################

zone sol-friable 9-11 7
zone sol-friable 19-21 7
zone plafond 3-21 2
zone denivele 22-24
(id: mur-friable
intention: Monter une cheminée au-dessus d'un puits de pics : son mur gauche s'effrite, pas question de traîner, puis le seuil cède aussi.
etiquettes: mural friable vertical
famille: cheminee
mutateurs: plafond denivele
format: 3
paliers: 17 7
repeter: haut rangees 10-10
variante: haut=3
variante: haut=4
variante: haut=4 +denivele:2
variante: haut=4 +plafond
grille:
####..........
####..........
####..........
###x..........
###x..........
###x..........
###x..........
###x..xxxx.###
###x..####.###
###x..####.###
###x..####.###
###x..####.###
###x..####.###
.##x..####.###
.##x..####.###
......####.###
......####.###
####..####.###
####..####.###
####^^####.###
##########.###

zone plafond 6-13 3
zone denivele 11-13
(id: mur-seul
intention: Remonter deux grands murs tout seul, saut mural après saut mural, en revenant vers chacun.
etiquettes: mural vertical
famille: mur
mutateurs: garde sol-friable denivele
format: 3
paliers: 16 4
repeter: haut rangees 12-12
variante: haut=1
variante: haut=3
variante: haut=2
variante: haut=3 +garde
variante: haut=1 +sol-friable
variante: haut=3 +denivele:2
grille:
..........
..........
..........
..........
.......###
.......###
.......###
.......###
.......###
.......###
....######
....######
....######
....######
....######
....######
##########
##########

zone garde 3 13-14 <
zone sol-friable 4-6 10
zone denivele 7-9
(id: mur-trous
intention: Remonter un mur tout seul, puis courir sur un toit percé dont les bords s'effritent sous les pieds.
etiquettes: mural friable vertical
famille: mur
enchainement: long
mutateurs: garde plafond denivele
format: 3
paliers: 22 8
repeter: haut rangees 15-15
repeter: trou colonnes 11-11
repeter: trou colonnes 25-25
variante: haut=1 trou=1
variante: haut=3 trou=1
variante: haut=1 trou=2
variante: haut=2 trou=1 +garde
variante: haut=1 trou=1 +plafond:pics
variante: haut=1 trou=2 +denivele:2
grille:
.......................................
.......................................
.......................................
.......................................
.......................................
.......................................
.......................................
.......................................
....#####x..x###x..x###x..x###x..x#####
....######..#####..#####..#####..######
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
....####...........................####
########...........................####
########...........................####
########...........................####

zone garde 3 18-19 <
zone plafond 8-34 3
zone denivele 35-38
(id: paroi-friable
intention: Remonter seul un mur de blocs friables : chaque appui le fait céder, il faut monter sans hésiter.
etiquettes: mural friable vertical
famille: mur
mutateurs: garde denivele
format: 3
paliers: 17 5
repeter: haut rangees 10-10
variante: haut=1
variante: haut=5
variante: haut=1 +garde
variante: haut=1 +denivele:2
grille:
..........
..........
..........
..........
..........
......x###
......x###
......x###
......x###
......x###
......x###
......x###
......x###
......x###
......x###
......x###
......x###
##########
##########

zone garde 5 14-15 <
zone denivele 7-9
(id: pendule
intention: Traverser une salle où trois scies descendent du plafond tour à tour, en passant sous chacune quand elle remonte.
etiquettes: scie
famille: pendule
mutateurs: sol-friable plafond denivele
format: 3
paliers: 12 12
variante: cycle=180
variante: cycle=240
variante: cycle=150
variante: cycle=240 +sol-friable
variante: cycle=180 +plafond:pics
variante: cycle=240 +denivele:2
grille:
.##################.
.##################.
.##################.
.##################.
....................
....................
....................
....................
....................
....................
....................
......#......#......
####################
####################

scie premiere o {cycle} aller-retour 3,4 3,11
scie seconde o {cycle} aller-retour 9,11 9,4
scie troisieme o {cycle} aller-retour 16,4 16,11
zone sol-friable 7-12 12
zone plafond 1-18 3
zone denivele 17-19
(id: petits-trous
intention: Sauter une file de petits trous en courant, sans lever le pied de l'accélérateur.
etiquettes: respiration
famille: trous
mutateurs: sol-friable denivele
format: 3
paliers: 8 8
repeter: trou colonnes 3-3
repeter: trou colonnes 9-9
repeter: trou colonnes 15-15
repeter: trou colonnes 21-21
variante: trou=1
variante: trou=2
variante: trou=3
variante: trou=2 +sol-friable
variante: trou=1 +denivele:2
grille:
.........................
.........................
.........................
.........................
.........................
.........................
.........................
.........................
###.#####.#####.#####.###
###.#####.#####.#####.###
###.#####.#####.#####.###

zone sol-friable 10-14 8
zone denivele 22-24
(id: piliers-scie
intention: Bondir de pilier en pilier, passer sous un bloc dont une scie fait le tour, puis reprendre les piliers.
etiquettes: precision scie
famille: piliers
enchainement: long
mutateurs: sol-friable fosse denivele
format: 3
paliers: 12 11
variante: cycle=240
variante: cycle=180
variante: cycle=300
variante: cycle=240 +sol-friable
variante: cycle=300 +fosse
variante: cycle=240 +denivele:2
grille:
.........................................................
.........................................................
.........................................................
.........................................................
.........................................................
.........................................................
.........................................................
.........................................................
.........................##..............................
.........................##..............................
.......................................#.......#.........
..........#.......#................#...#...#...#...#..###
###...#...#...#...#..###########...#...#...#...#...#..###
###...#...#...#...#..###########...#...#...#...#...#..###
###...#...#...#...#..###########...#...#...#...#...#..###
###...#...#...#...#..###########...#...#...#...#...#..###

scie ronde o {cycle} boucle 24,7 27,7 27,11 24,11
zone sol-friable 6 12
zone sol-friable 14 12
zone sol-friable 39 10
zone sol-friable 47 10
zone fosse 32-34 15
zone fosse 36-38 15
zone denivele 54-56
(id: piliers
intention: Bondir de pilier en pilier, chacun large d'une seule tuile, au-dessus du vide.
etiquettes: precision
famille: piliers
mutateurs: patrouille sol-friable denivele
format: 3
paliers: 10 10
repeter: ecart colonnes 5-5
repeter: ecart colonnes 9-9
repeter: ecart colonnes 13-13
repeter: ecart colonnes 17-17
repeter: ecart colonnes 21-21
variante: ecart=1
variante: ecart=2
variante: ecart=1 +patrouille
variante: ecart=2 +sol-friable
variante: ecart=1 +denivele:2
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

zone patrouille o 360 aller-retour 6,4 18,4
zone sol-friable 6 10
zone sol-friable 14 10
zone denivele 22-23
(id: plafond-pics
intention: Courir sous un plafond hérissé et enjamber les pics du sol par petits sauts : un grand saut s'y empale.
etiquettes: precision
famille: plafond
mutateurs: sol-friable denivele surface
format: 3
paliers: 10 10
repeter: pics colonnes 4-4
repeter: pics colonnes 9-9
repeter: pics colonnes 14-14
repeter: pics colonnes 19-19
variante: pics=1
variante: pics=2
variante: pics=1 +sol-friable
variante: pics=2 +sol-friable
variante: pics=1 +surface:glace
grille:
.######################..
.######################..
.######################..
.######################..
.######################..
.######################..
.vvvvvvvvvvvvvvvvvvvvvv..
.........................
.........................
....^....^....^....^.....
#########################
#########################

zone sol-friable 5-8 10
zone sol-friable 15-18 10
zone denivele 20-24
zone surface 1-22 10
(id: plongeon
intention: Plonger d'une corniche haute dans un couloir bas où une scie roule au sol, et la sauter sans se cogner au plafond.
etiquettes: scie vertical
famille: plongeon
mutateurs: sol-friable surface
format: 3
paliers: 6 16
variante: cycle=240
variante: cycle=300
variante: cycle=240 +sol-friable
variante: cycle=240 +surface:glace
variante: cycle=300 +surface:tapis:gauche
variante: cycle=240 +surface:tapis:droite
grille:
........##########
........##########
........##########
........##########
........##########
........##########
###.....##########
###.....##########
###.....##########
###.....##########
###.....##########
###.....##########
###.....##########
###...............
###...............
###...............
##################
##################

scie balai o {cycle} aller-retour 9,15 15,15
zone sol-friable 3-7 16
zone surface 8-16 16
(id: pont-friable
intention: Traverser un pont friable coupé de trous, tronçon après tronçon, sans jamais s'arrêter.
etiquettes: friable
famille: pont
mutateurs: plafond fosse denivele
format: 3
paliers: 9 9
repeter: ecart colonnes 6-6
repeter: ecart colonnes 11-11
repeter: ecart colonnes 16-16
variante: ecart=1
variante: ecart=2
variante: ecart=3
variante: ecart=2 +plafond
variante: ecart=1 +plafond:pics
variante: ecart=2 +fosse +denivele:2
grille:
.......................
.......................
.......................
.......................
.......................
.......................
.......................
.......................
.......................
##xxxx.xxxx.xxxx.xxxx##
##...................##
##...................##

zone plafond 2-20 5
zone fosse 2-20 11
zone denivele 21-22
(id: pont-patrouille
intention: Traverser un pont friable pendant que deux scies patrouillent juste au-dessus, puis grimper d'îlot en îlot.
etiquettes: friable scie precision vertical
famille: pont
enchainement: long
mutateurs: fosse plafond
format: 3
paliers: 14 6
repeter: ecart colonnes 6-6
repeter: ecart colonnes 16-16
repeter: ecart colonnes 26-26
variante: ecart=1 cycle=660 +fosse
variante: ecart=1 cycle=630 +fosse
variante: ecart=1 cycle=600 +fosse
variante: ecart=1 cycle=720 +fosse
grille:
......................................................
......................................................
......................................................
......................................................
......................................................
......................................................
............................................xx..xx.###
...................................................###
........................................xx.........###
...................................................###
....................................xx.............###
...................................................###
................................xx.................###
...................................................###
##xxxx.xxxx.xxxx.xxxx.xxxx.xxxx....................###
##.................................................###
##.................................................###
##.................................................###

scie haute o {cycle} aller-retour 3,11 15,11
scie basse o {cycle} aller-retour 29,11 17,11
zone fosse 2-31 17
zone plafond 2-29 7
(id: puits-descente
intention: Se laisser glisser contre le mur d'un puits pour attraper sa porte basse, puis dévaler une cascade de corniches jusqu'en bas.
etiquettes: mural vertical
famille: puits
enchainement: long
mutateurs: garde fosse denivele
format: 3
paliers: 4 27
repeter: large colonnes 4-4
repeter: ecart colonnes 16-16
repeter: ecart colonnes 23-23
repeter: ecart colonnes 37-37
variante: large=2 ecart=2
variante: large=2 ecart=3
variante: large=2 ecart=2 +garde
variante: large=2 ecart=3 +denivele:1
grille:
......####......................................
......####......................................
......####......................................
......####......................................
###...####......................................
###...####......................................
###...####......................................
###...####......................................
###...####......................................
###...####......................................
###...####......................................
###...####......................................
###...####......................................
###.............................................
###.............................................
###.............................................
###...####......................................
###...####......................................
###^^^####......................................
##########.###..................................
##########.###..................................
##########.###....###...........................
##########.###....###...........................
##########.###....###...###.....................
##########.###....###...###.....................
##########.###....###...###...###...............
##########.###....###...###...###...###.........
##########.###....###...###...###...###...######
##########.###....###...###...###...###...######

zone garde 5 6-8 <
zone fosse 14-17 28
zone fosse 27-29 28
zone denivele 45-47
(id: puits
intention: Se laisser glisser contre le mur d'un puits pour ne pas manquer la porte de sortie, puis sauter le trou du couloir.
etiquettes: mural vertical
famille: puits
mutateurs: garde fosse denivele
format: 3
paliers: 4 18
repeter: large colonnes 4-4
repeter: prof rangees 9-9
variante: large=1 prof=6
variante: large=1 prof=4 +garde
variante: large=2 prof=3 +fosse
variante: large=1 prof=3 +denivele:2
grille:
......########
......########
......########
......########
###...########
###...########
###...########
###...########
###...########
###...########
###...########
###...########
###...########
###...########
###...........
###...........
###...........
###...........
###...###..###
###^^^###..###
#########..###
#########..###

zone garde 5 6-8 <
zone fosse 9-10 20
zone denivele 11-13
(id: quinconce
intention: Passer entre des scies en quinconce : sauter celles du sol, rester sous celles du haut.
etiquettes: scie precision
famille: quinconce
mutateurs: plafond sol-friable denivele
format: 3
paliers: 11 11
repeter: ecart colonnes 6-6
repeter: ecart colonnes 9-9
repeter: ecart colonnes 12-12
repeter: ecart colonnes 15-15
repeter: ecart colonnes 18-18
variante: ecart=1
variante: ecart=2
variante: ecart=3
variante: ecart=2 +plafond:pics
variante: ecart=2 +sol-friable
variante: ecart=1 +denivele:2
grille:
...##################..
...##################..
...##################..
...##################..
...##################..
...##################..
.......................
.......................
.......o.....o.....o...
.......................
....o.....o.....o......
#######################
#######################

zone plafond 3-20 6
zone sol-friable 5-9 11
zone denivele 21-22
(id: rebonds-doux
intention: Courir sur une piste semée de ressorts : chaque rebond porte loin, il suffit de garder le rythme.
etiquettes: respiration ressort
famille: rebonds-doux
mutateurs: plafond denivele
format: 3
paliers: 12 12
repeter: long colonnes 6-6
repeter: long colonnes 11-11
variante: long=1
variante: long=3
variante: long=2 +plafond
variante: long=1 +denivele:2
grille:
.................
.................
.................
.................
.................
.................
.................
.................
.................
.................
.................
.................
###*####*####*###
#################
#################

zone plafond 0-16 5
zone denivele 14-16
(id: ressort-mur-iles
intention: Le ressort lance contre un mur à finir d'escalader, puis des îlots friables à enchaîner sans s'arrêter.
etiquettes: ressort mural friable precision vertical
famille: ressort
enchainement: long
mutateurs: patrouille plafond denivele
format: 3
paliers: 22 10
repeter: ecart colonnes 16-16
repeter: ecart colonnes 21-21
repeter: ecart colonnes 31-31
variante: ecart=1
variante: ecart=2
variante: ecart=1 +patrouille
variante: ecart=2 +plafond:pics
variante: ecart=1 +denivele:3
grille:
...........................................
...........................................
...........................................
...........................................
...........................................
...........................................
...........................................
...........................................
..................xx........xx.............
.............xx........xx........xx........
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
.......###............................#####
####*#####............................#####
####.#####............................#####
####.#####............................#####

zone patrouille o 300 aller-retour 12,5 35,5
zone plafond 10-37 3
zone denivele 38-42
(id: ressort-mur
intention: Prendre le ressort au pied d'un mur hérissé et retomber sur son sommet, sans frôler les pics.
etiquettes: ressort vertical
famille: ressort
mutateurs: plafond garde denivele
format: 3
paliers: 19 13
repeter: ecart colonnes 5-5
variante: ecart=1
variante: ecart=2
variante: ecart=1 +plafond:pics
variante: ecart=2 +garde
variante: ecart=1 +denivele:3
grille:
.............
.............
.............
.............
.............
.............
.............
.............
.............
.............
.............
.............
.............
........#####
.......<#####
.......<#####
.......<#####
.......<#####
.......<#####
###*#########
#############
#############

zone plafond 0-12 4
zone garde 10 12 ^
zone denivele 8-12
(id: ressort-plafond
intention: Le ressort lance sous un plafond à pics : arriver assez vite pour le dépasser et se poser sur la corniche.
etiquettes: ressort precision
famille: ressort
mutateurs: sol-friable denivele
format: 3
paliers: 18 13
repeter: bord colonnes 7-7
variante: bord=1
variante: bord=2
variante: bord=4
variante: bord=2 +sol-friable
variante: bord=1 +denivele:2
grille:
..######......
..######......
..######......
..######......
..######......
..######......
..######......
..######......
..######......
..######......
..######......
..vvvvvv......
..............
..........####
..........####
..........####
..........####
..........####
######*#######
##############
##############

zone sol-friable 10-13 13
zone denivele 10-13
(id: ressort-scie
intention: Le ressort lance dans un puits que traverse une scie : partir au bon moment pour passer derrière elle.
etiquettes: ressort scie vertical
famille: ressort-scie
mutateurs: garde denivele
format: 3
paliers: 21 15
variante: cycle=300
variante: cycle=360
variante: cycle=300 +denivele:2
grille:
............
............
............
............
............
............
............
............
..#.........
..#.........
..#.........
..#.........
..#.........
..#.........
..#.........
..#...######
..#...######
..#...######
..#...######
......######
......######
####*#######
############
############

scie traverse o {cycle} aller-retour 3,17 5,17
zone garde 3 12-13 >
zone denivele 6-11
(id: ressorts-escalier
intention: Monter de ressort en ressort, chacun posé sur une corniche plus haute, au-dessus du vide.
etiquettes: ressort vertical precision
famille: rebonds
mutateurs: plafond fosse denivele
format: 3
paliers: 22 10
repeter: ecart colonnes 6-6
repeter: ecart colonnes 13-13
repeter: ecart colonnes 20-20
variante: ecart=1
variante: ecart=2
variante: ecart=1 +plafond:pics
variante: ecart=2 +fosse
variante: ecart=1 +denivele:-2
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
......................######
......................######
......................######
......................######
...............##*....######
...............###....######
...............###....######
...............###....######
........##*....###....######
........###....###....######
........###....###....######
........###....###....######
###*....###....###....######
####....###....###....######
####....###....###....######
####....###....###....######

zone plafond 4-21 1
zone fosse 4-7 25
zone fosse 11-14 25
zone fosse 18-21 25
zone denivele 22-27
(id: ressorts-trous
intention: Rebondir de ressort en ressort au-dessus d'une fosse à pics, sans lâcher la course.
etiquettes: ressort precision
famille: rebonds
mutateurs: plafond denivele
format: 3
paliers: 13 13
repeter: ecart colonnes 12-12
repeter: ecart colonnes 23-23
repeter: ecart colonnes 34-34
variante: ecart=1
variante: ecart=1 +plafond +denivele:2
variante: ecart=1 +plafond
variante: ecart=1 +denivele:2
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

zone plafond 4-35 3
zone denivele 37-39
(id: saut-long
intention: Prendre tout son élan et franchir un grand trou d'un seul saut.
etiquettes: precision
famille: saut-long
elan: oui
mutateurs: plafond fosse denivele
format: 3
paliers: 9 9
repeter: trou colonnes 8-8
variante: trou=5
variante: trou=6
variante: trou=7
variante: trou=5 +plafond
variante: trou=6 +fosse
variante: trou=5 +denivele:3
grille:
.............
.............
.............
.............
.............
.............
.............
.............
.............
########.####
########.####
########.####

zone plafond 4-12 4
zone fosse 8 11
zone denivele 9-12
(id: saut-plafond
intention: Franchir deux trous sous un plafond bas : un saut s'y cogne la tête, seule la pleine vitesse fait passer.
etiquettes: precision
famille: saut-long
mutateurs: plafond fosse denivele
format: 3
paliers: 10 10
repeter: trou colonnes 5-5
repeter: trou colonnes 14-14
variante: trou=1
variante: trou=2
variante: trou=1 +plafond:pics
variante: trou=1 +fosse
variante: trou=2 +denivele:1
grille:
.####################.
.####################.
.####################.
.####################.
.####################.
.####################.
.####################.
......................
......................
......................
####....#####....#####
####....#####....#####
####....#####....#####

zone plafond 1-20 6
zone fosse 4-7 12
zone fosse 13-16 12
zone denivele 17-21
(id: scie-ronde
intention: Passer sous deux blocs suspendus pendant que la scie qui fait le tour de chacun est au-dessus.
etiquettes: scie
famille: scie-ronde
mutateurs: sol-friable denivele surface
format: 3
paliers: 10 10
variante: cycle=240
variante: cycle=180
variante: cycle=240 +sol-friable
variante: cycle=180 +denivele:2
variante: cycle=240 +surface:glace
variante: cycle=300 +surface:tapis:droite
grille:
.................
.................
.................
.................
.................
.................
....##.....##....
....##.....##....
.................
.................
#################
#################
#################

scie ronde o {cycle} boucle 3,5 6,5 6,9 3,9
scie ronde2 o {cycle} boucle 13,9 13,5 10,5 10,9
zone sol-friable 7-9 10
zone denivele 14-16
zone surface 1-15 10
(id: scie-sol
intention: Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires.
etiquettes: scie
famille: scie-sol
mutateurs: patrouille sol-friable denivele
format: 3
paliers: 10 10
variante: cycle=300
variante: cycle=240
variante: cycle=360
variante: cycle=300 +patrouille
variante: cycle=240 +sol-friable
variante: cycle=240 +denivele:2
grille:
..##################..
..##################..
..##################..
..##################..
..##################..
..##################..
..##################..
......................
......................
......................
######################
######################

scie patrouille o {cycle} aller-retour 4,9 17,9
scie contre o {cycle} aller-retour 17,9 4,9
zone patrouille o 200 aller-retour 10,9 4,9
zone sol-friable 8-13 10
zone denivele 20-21
(id: scies-jumelles
intention: Deux scies tournent en sens contraires autour de chaque borne : la sauter au moment où elles s'écartent.
etiquettes: scie precision
famille: scies-jumelles
mutateurs: sol-friable plafond denivele
format: 3
paliers: 10 10
variante: cycle=240
variante: cycle=180
variante: cycle=300
variante: cycle=240 +sol-friable
variante: cycle=300 +plafond
variante: cycle=180 +denivele:2
grille:
...................
...................
...................
...................
...................
...................
...................
...................
.....#......#......
.....#......#......
###################
###################
###################

scie a o {cycle} boucle 4,7 6,7 6,9 4,9
scie b o {cycle} boucle 6,9 4,9 4,7 6,7
scie c o {cycle} boucle 11,7 13,7 13,9 11,9
scie d o {cycle} boucle 13,9 11,9 11,7 13,7
zone sol-friable 8-9 10
zone plafond 0-18 2
zone denivele 16-18
(id: tapis-alternes
intention: Franchir des tapis qui se croisent au-dessus des pics : chaque plateforme tire dans son sens, sauter de l'une à l'autre en gardant le rythme.
etiquettes: tapis precision
famille: tapis-alternes
theme: usine
mutateurs: denivele
format: 3
paliers: 9 9
repeter: alt colonnes 0-9
variante: alt=2
variante: alt=3
variante: alt=4
variante: alt=3 +denivele:2
grille:
.............
.............
.............
.............
.............
.............
.............
.............
.............
]]]^^[[[^^]]]
#############
#############

zone denivele 10-12
(id: tapis-contraire
intention: Remonter un tapis roulant qui recule en passant sous des scies qui descendent à tour de rôle : avancer au bon moment, sans se laisser ramener.
etiquettes: tapis scie
famille: tapis-contraire
theme: usine
mutateurs: denivele
format: 3
paliers: 9 9
repeter: long colonnes 8-8
variante: long=1 cycle=240
variante: long=3 cycle=240
variante: long=1 cycle=180
variante: long=3 cycle=300 +denivele:2
grille:
..................
..................
..................
..................
..................
..................
..................
..................
..................
[[[[[[[[[[[[[[[[[[
##################
##################

scie s1 1 {cycle} aller-retour 5,3 5,8
scie s2 1 {cycle} aller-retour 12,8 12,3
zone denivele 15-17
(id: tapis-escalier
intention: Gravir un escalier dont chaque marche est un tapis qui recule : sauter de marche en marche avant d'être ramené en arrière.
etiquettes: tapis precision vertical
famille: tapis-escalier
theme: usine
mutateurs: denivele
format: 3
paliers: 12 8
repeter: marche colonnes 15-15
variante: marche=1
variante: marche=2
variante: marche=3
variante: marche=2 +denivele:2
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
............[[[[
........[[[[####
....[[[[########
[[[[############
################
################
################

zone denivele 14-15
(id: tapis-lance
intention: Un tapis qui lance un saut trop long à pied : sauter au bord et retenir son élan pour se poser sur la plateforme avant les pics.
etiquettes: tapis precision
famille: tapis-lance
theme: usine
mutateurs: denivele
format: 3
paliers: 9 9
repeter: trou colonnes 8-8
repeter: pique colonnes 13-13
variante: trou=5 pique=3
variante: trou=4 pique=3
variante: trou=6 pique=4
variante: trou=5 pique=5 +denivele:2
grille:
................
................
................
................
................
................
................
................
.............^..
]]]]]]]].#######
########.#######
########.#######

zone denivele 14-15
(id: tapis-mur
intention: Se laisser emporter par un tapis jusqu'au pied d'un mur, puis le remonter saut mural après saut mural sans retomber sur le tapis.
etiquettes: tapis mural vertical
famille: tapis-mur
theme: usine
mutateurs: denivele
format: 3
paliers: 13 6
repeter: haut rangees 8-8
repeter: long colonnes 2-2
variante: haut=1 long=1
variante: haut=2 long=2
variante: haut=3 long=1
variante: haut=1 long=3 +denivele:2
grille:
............
............
............
............
............
............
......######
......######
......######
......######
......######
......######
......######
]]]]]]######
############
############

zone denivele 9-11
(id: tapis-relais
intention: Remonter un long tapis contraire sous des scies, franchir des tapis croisés au-dessus des pics, puis se faire lancer au-dessus d'un trou : garder son élan, puis le retenir.
etiquettes: tapis scie precision
famille: tapis-relais
enchainement: long
theme: usine
format: 3
paliers: 9 9
repeter: trou colonnes 53-53
repeter: pique colonnes 58-58
variante: trou=5 pique=3 cycle=420
variante: trou=4 pique=3 cycle=390
variante: trou=5 pique=4 cycle=360
grille:
.............................................................
.............................................................
.............................................................
.............................................................
.............................................................
.............................................................
.............................................................
.............................................................
..........................................................^..
[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[##]]]^^[[[^^]]]]]]].#######
#####################################################.#######
#####################################################.#######

scie s1 1 {cycle} aller-retour 5,3 5,8
scie s2 1 {cycle} aller-retour 11,8 11,3
scie s3 1 {cycle} aller-retour 17,3 17,8
scie s4 1 {cycle} aller-retour 23,8 23,3
scie s5 1 {cycle} aller-retour 29,3 29,8
(id: tapis-respiration
intention: Se laisser porter par un tapis rapide en sautant de petites marches : le tapis fait le travail, il suffit de garder le rythme.
etiquettes: tapis respiration
famille: tapis-respiration
theme: usine
mutateurs: denivele
format: 3
paliers: 9 9
repeter: suite colonnes 0-9
variante: suite=3
variante: suite=4
grille:
............
............
............
............
............
............
............
............
........#...
]]]]]]]]]]]]
############
############

zone denivele 10-11
(id: toboggan
intention: Dévaler un escalier dont chaque marche porte un pic là où l'on retombe en courant : sauter chaque marche au lieu de s'en laisser tomber.
etiquettes: precision
famille: toboggan
mutateurs: sol-friable denivele
format: 3
paliers: 6 20
repeter: large colonnes 5-5
repeter: large colonnes 13-13
repeter: large colonnes 21-21
variante: large=1
variante: large=1 +denivele:1
grille:
..............................
..............................
..............................
..............................
..............................
..............................
###...........................
###..^........................
#######.......................
#######..^....................
###########...................
###########..^................
###############...............
###############..^............
###################...........
###################..^........
#######################.......
#######################..^....
###########################...
###########################...
##############################
##############################

zone sol-friable 9-10 10
zone sol-friable 17-18 14
zone denivele 27-29
(id: tremplin
intention: Un ressort au bord d'un grand trou : rebondir à pleine vitesse pour le franchir, deux fois de suite.
etiquettes: ressort precision
famille: tremplin
mutateurs: plafond fosse denivele
format: 3
paliers: 12 12
repeter: trou colonnes 8-8
repeter: trou colonnes 20-20
variante: trou=0
variante: trou=0 +denivele:2
variante: trou=0 +plafond
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
............................
.....*...........*..........
######.....#######.....#####
######.....#######.....#####
######.....#######.....#####
######.....#######.....#####

zone plafond 6-22 2
zone fosse 6-10 15
zone fosse 18-22 15
zone denivele 23-27
(id: tunnel-scies
intention: Traverser un couloir bas où roulent des scies en sens contraires, puis remonter la cheminée qui l'achève.
etiquettes: scie mural vertical
famille: tunnel-scies
enchainement: long
mutateurs: sol-friable
format: 3
paliers: 23 4
repeter: large colonnes 41-41
variante: large=1 cycle=720
variante: large=1 cycle=600 +sol-friable
grille:
..######################################......
..######################################......
..######################################......
..######################################......
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..######################################..####
..........................................####
..........................................####
..........................................####
......o.....o.....o.......................####
##############################################
##############################################
##############################################

scie roule o {cycle} aller-retour 37,22 24,22
zone sol-friable 2-11 23
(id: tunnel
intention: Traverser un tunnel haut de plafond semé de bosses espacées : de petits sauts rythmés, sans se presser.
etiquettes: respiration
famille: tunnel
mutateurs: plafond denivele
format: 3
paliers: 9 9
repeter: long colonnes 3-6
variante: long=2
variante: long=1
variante: long=1 +denivele:2
variante: long=2 +denivele:2
grille:
.###########.
.###########.
.###########.
.###########.
.###########.
.............
.............
.............
.....#...#...
#############
#############

zone plafond 1-11 4
zone denivele 12-12
`.split(`(`),ft={jumpSimVersion:3,exigenceVersion:3,modules:{ascenseur:{variants:[{grid:`e99e544f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowAJICVrIDZvIG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,940],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowBIoBZoIEVtIG`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`48c29b3f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxANoCfrIDZoIG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxBKICfrIDVvIF`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,990,940],raccord:1e3,exigence:2}},{grid:`816c738f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyAIoCZvoEVuIG`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyBIoBdvoEZuoG`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`e7a3286b`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjozAIoCXroDbuIG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjozBJIBfroDbuIG`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`7e1d7957`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo0APoCboIEVuIG`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo0BIoBhgHqBGbqBg`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7b4e0889`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo1AOICbroDXooG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo1BKICbtIDRvIF`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,945],raccord:1e3,exigence:2}}]},"cheminee-pics":{variants:[{grid:`6a2ba0e7`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MADaA1h0nQESrgEy_gIi5AFBJeIBJvIG`,ticks:365,entryTick:0,exitTick:358,fastest:358,rapide:339,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MASKA2h0fRquAUr2AgpuXH0KLuII`,ticks:356,entryTick:17,exitTick:350,fastest:333,rapide:308,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`9f932a66`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQCSAmYZUkn9ATg8Pl0SngFlMaYIag`,ticks:315,entryTick:0,exitTick:308,fastest:308,rapide:293,gigue:[1e3,970,890],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQSCA0hsjQFp3gEyPkRtGS3qCA`,ticks:310,entryTick:17,exitTick:303,fastest:286,rapide:267,gigue:[1e3,1e3,845],raccord:1e3,exigence:3}},{grid:`69377583`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgCKAmYJSkGtAjg8Pl0qfmUxpghi`,ticks:314,entryTick:0,exitTick:307,fastest:307,rapide:293,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgSKA0hUrQFx1gFCTlRtIT3qCA`,ticks:321,entryTick:17,exitTick:314,fastest:297,rapide:267,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]},"cheminee-quinconce":{variants:[{grid:`40acf130`,arret:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZTowAMoDXgoeClZFIm4KdiQINGUJnQEKXghcEo4BggNWygg-igMuigM-8gI2ygY`,ticks:678,entryTick:0,exitTick:671,fastest:671,rapide:653,gigue:[920,930,650],raccord:null,exigence:4},elan:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZTowBIoDlgEKbk0KXiUJNTwJrQEILDUJHUYIXAltVCbCAmaCCTaSAx6CAzbqAjb6Bg`,ticks:677,entryTick:17,exitTick:670,fastest:653,rapide:625,gigue:[1e3,970,765],raccord:1e3,exigence:3}},{grid:`c04fe696`,arret:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZToxANIDZgoOGk51El4iRjQILHUJPVYSZghkCn6KA16iCE6KAy6CAzbyAjbqBg`,ticks:680,entryTick:0,exitTick:673,fastest:673,rapide:653,gigue:[995,895,590],raccord:null,exigence:5},elan:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZToxBIIDzgE6Pl0KFjxFCUUkCY0BCCxFES1uCDwJDTQ2ggNmoge2AeIDNvICRooDLsoG`,ticks:680,entryTick:17,exitTick:673,fastest:656,rapide:625,gigue:[1e3,960,870],raccord:1e3,exigence:2}},{grid:`602357f8`,arret:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZToyANIDngEKHmUKXgpeLAg0ZQltDhJ2CHQqXoIDTtIIRooDJooDRoIDFvIG`,ticks:676,entryTick:0,exitTick:669,fastest:669,rapide:653,gigue:[1e3,995,915],raccord:null,exigence:2},elan:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZToyBIIDzgEiNnUKLoQBCXUMEYUBCEwVCTUuKDwJLVQWggNm8ghG-gImigM-igMO2gY`,ticks:681,entryTick:17,exitTick:674,fastest:657,rapide:625,gigue:[1e3,965,845],raccord:1e3,exigence:3}}]},"cheminee-scie":{variants:[{grid:`74c1857e`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MACCBKYBCmxVCM4BGe0BYRWmB4oB`,ticks:313,entryTick:0,exitTick:306,fastest:306,rapide:291,gigue:[1e3,880,745],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MASaA84BCFRNOIYBMhbtAXg0rgdi`,ticks:306,entryTick:17,exitTick:300,fastest:283,rapide:264,gigue:[1e3,940,810],raccord:1e3,exigence:3}},{grid:`80f0696b`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQDiA94BClRNIL4BCh61AhLmB1I`,ticks:312,entryTick:0,exitTick:306,fastest:306,rapide:295,gigue:[995,980,835],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQT6Au4BCkRtDBqmAQoWJPUBEjzqAhaSBQ`,ticks:297,entryTick:17,exitTick:290,fastest:273,rapide:267,gigue:[1e3,955,755],raccord:1e3,exigence:3}},{grid:`2f552cc5`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgDKA_YBChxtRAquAQoOHG0WdUA2ggMe6gQ`,ticks:310,entryTick:0,exitTick:304,fastest:304,gigue:[980,940,720],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgSCA94BKiRlYpYBGsUBJokBTJIDFtoE`,ticks:310,entryTick:17,exitTick:303,fastest:286,rapide:279,gigue:[1e3,945,800],raccord:1e3,exigence:3}},{grid:`3c47ad1a`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwDSA-YBEkRlCLYBEhadAR6FAQruB0o`,ticks:308,entryTick:0,exitTick:302,fastest:302,rapide:295,gigue:[990,975,890],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwTyAt4BEkRdJBKuAQoeFN0BGmbSBw`,ticks:291,entryTick:17,exitTick:284,fastest:267,gigue:[965,815,530],raccord:1e3,exigence:5}}]},"cheminee-vide":{variants:[{grid:`9273d9b2`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MADaAW6KApQBCk4QXAktNgouNQgs9gRS`,ticks:232,entryTick:0,exitTick:225,fastest:225,gigue:[1e3,995,965],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MATqAYYCGkwlCl4KPiQhhgVa`,ticks:196,entryTick:17,exitTick:189,fastest:171,gigue:[1e3,845,775],raccord:1e3,exigence:3}},{grid:`7a65ef39`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQAargJBhgMipgMKjgG6At4ECh6iBQ`,ticks:372,entryTick:0,exitTick:365,fastest:363,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQTyAcYBCj4KPj0KVhwdCWUKtgGiBA`,ticks:198,entryTick:17,exitTick:191,fastest:174,gigue:[1e3,1e3,805],raccord:1e3,exigence:3}},{grid:`2bd63861`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MgDSAXaKAowBCl4IXAktZAk1KDX2BEI`,ticks:236,entryTick:0,exitTick:229,fastest:229,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MgTqAcYBClYSLjUKLjwVCU0sCr4BkgQ`,ticks:197,entryTick:17,exitTick:191,fastest:174,gigue:[1e3,760,525],raccord:1e3,exigence:5}},{grid:`b1abc18e`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MwAaxgIZjgMingMR_gQSHooF`,ticks:317,entryTick:0,exitTick:310,fastest:310,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MwTqAYYCIkQlCl4KPiQhhgVa`,ticks:196,entryTick:17,exitTick:189,fastest:171,gigue:[1e3,780,750],raccord:1e3,exigence:3}},{grid:`483d871a`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NACKAnaiAmYkVQpIjgEwdUYgJCWmBVo`,ticks:271,entryTick:0,exitTick:264,fastest:264,gigue:[1e3,995,930],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NATqAcYBCo4BCi5kYdYFWg`,ticks:202,entryTick:17,exitTick:196,fastest:179,gigue:[1e3,685,510],raccord:1e3,exigence:5}}]},cheminee:{variants:[{grid:`2c07a73f`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAAwgPeAQomJEVEErYBCh4kRSEkIYoCToIH`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[1e3,785,585],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAE6gLmARIOHE1MIqYBEhYkRUFGkgI-6gY`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[980,750,565],raccord:1e3,exigence:5}},{grid:`33488765`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEAwgPeARIWJE1EIqYBCh4khQEKfvoBHuIG`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[1e3,735,565],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEE6gLmAQoWLI0BCq4BCiYkhQEKfooCHsoG`,ticks:302,entryTick:17,exitTick:295,fastest:279,gigue:[1e3,835,665],raccord:1e3,exigence:4}},{grid:`2a4d0379`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIA0gPWAQo2bSQStgEKFix9Eo4B2gg`,ticks:313,entryTick:0,exitTick:306,fastest:307,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIE6gLmAQoeHE1ECrYBEhYshQEKhgHqCA`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[1e3,755,705],raccord:1e3,exigence:4}}]},"chute-pics":{variants:[{grid:`c272a5cc`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MABKngSpAnIpogI04gM`,ticks:234,entryTick:0,exitTick:227,fastest:227,gigue:[1e3,960,940],raccord:null,exigence:2},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MASKASaqA3ihAeIBQOIBJNID`,ticks:235,entryTick:17,exitTick:228,fastest:211,gigue:[1e3,965,850],raccord:1e3,exigence:2}},{grid:`fca5c7ac`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MQBiNtoD0QL6ATDCATbCAw`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[770,830,705],raccord:null,exigence:4},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MQSKASaiA4ABwQHCAiDCASaiAmZK`,ticks:242,entryTick:17,exitTick:236,fastest:219,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`3e2b1c34`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MgCSATZqYFqRAdAC8gEwsgNgkgE`,ticks:240,entryTick:0,exitTick:233,fastest:232,gigue:[1e3,935,790],raccord:null,exigence:3},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MgSaAR6CAskCogJh8gE0ogIxcg`,ticks:235,entryTick:17,exitTick:228,fastest:213,gigue:[1e3,895,715],raccord:1e3,exigence:4}},{grid:`19989458`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MwBiNtoDqQIyKYoDNMID`,ticks:236,entryTick:0,exitTick:229,fastest:229,gigue:[825,790,735],raccord:null,exigence:3},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MwSKASbiAiDBAoABwgMmogEgQcIB`,ticks:241,entryTick:17,exitTick:234,fastest:217,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`2200b1dc`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6NABiNuIDoQJgMaIClgRK`,ticks:243,entryTick:0,exitTick:236,fastest:236,gigue:[1e3,990,940],raccord:null,exigence:2},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6NASqAQ4YMYoBLEEiIIEBoAIhIMIChgRC`,ticks:241,entryTick:17,exitTick:234,fastest:218,gigue:[1e3,975,945],raccord:1e3,exigence:2}}]},corniches:{variants:[{grid:`fd953b95`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczowAMIBhgHCA4YMQg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczowBIoBhgGiA4YBygs`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a6e04ff6`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoxAMIBxgQyhg9K`,ticks:351,entryTick:0,exitTick:344,fastest:344,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoxBIoBxgQy1g5a`,ticks:340,entryTick:17,exitTick:334,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d4aff602`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoyAMIBhgHCA4YMQg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoyBIoBhgGiA4YBygs`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0b3041f6`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczozAMIBxgQyhg9K`,ticks:351,entryTick:0,exitTick:344,fastest:344,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczozBIoBxgQy1g5a`,ticks:340,entryTick:17,exitTick:334,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"demi-tour-ressorts":{variants:[{grid:`c324c05b`,arret:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czowAIoBlgHCFwkSIDIYEhkiGSJRKBo4ChlCEDI4CbIBiAESMBoZGDIYGRoIjgGaBg`,ticks:684,entryTick:0,exitTick:677,fastest:678,gigue:[745,620,625],raccord:null,exigence:4},elan:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czowBLICDtIaaUIQItgBMoABKghaTZ4B4gU`,ticks:678,entryTick:17,exitTick:671,fastest:655,gigue:[845,705,725],raccord:1e3,exigence:3}},{grid:`f2c677db`,arret:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czoxAJIBlgGKFxgZGjASMBoREiEqSTAaMCIZOjAiGAmiAYgBIjAaGRgyGBkaCO4BwgU`,ticks:685,entryTick:0,exitTick:678,fastest:678,gigue:[670,580,535],raccord:null,exigence:5},elan:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czoxBNICDpIaIGFCqAESCFKQASJAUh2GAqIF`,ticks:678,entryTick:17,exitTick:671,fastest:655,gigue:[785,715,565],raccord:1e3,exigence:5}},{grid:`b57b0ecc`,arret:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czoyAJoBhgHyFhFaMCooIhE6UTASQCIJKjBKCAmqAbABGhASGRgyGBkaCM4B4gU`,ticks:685,entryTick:0,exitTick:678,fastest:678,gigue:[870,900,760],raccord:null,exigence:3},elan:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czoyBMICDvIZQHlaYAqAAUIoajhKRdYB2gU`,ticks:685,entryTick:17,exitTick:678,fastest:661,rapide:655,gigue:[990,825,675],raccord:1e3,exigence:4}}]},"demi-tour":{variants:[{grid:`545deeae`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowAIIBtgEqjgQy9gdi`,ticks:252,entryTick:0,exitTick:245,fastest:245,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowBIoB5gJQ1QEOpQEQbiUk6gU`,ticks:234,entryTick:17,exitTick:227,fastest:214,gigue:[1e3,995,945],raccord:1e3,exigence:2}},{grid:`d8011005`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxACLGAgreBCKmCEI`,ticks:264,entryTick:0,exitTick:258,fastest:256,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxBIoBLp0BCr4EMqYISg`,ticks:260,entryTick:17,exitTick:253,fastest:236,gigue:[1e3,1e3,925],raccord:1e3,exigence:2}},{grid:`d5734b47`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyAHK-ATqOBggSEDSeAZIH`,ticks:285,entryTick:0,exitTick:279,fastest:281,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyBIoBLpUBCsYFQr4ISg`,ticks:281,entryTick:17,exitTick:274,fastest:258,gigue:[1e3,1e3,910],raccord:1e3,exigence:2}},{grid:`5912db5a`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjozADK2AgrWBBLGAboH`,ticks:264,entryTick:0,exitTick:257,fastest:259,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjozBIoBHtUBCqYFMsYHQg`,ticks:265,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,985,930],raccord:1e3,exigence:2}},{grid:`d45c7b1e`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo0ADKuAgq2BSL-BkI`,ticks:253,entryTick:0,exitTick:246,fastest:247,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo0BJoBJtICIOUBDpUBEF40HRTqBQ`,ticks:233,entryTick:17,exitTick:226,fastest:214,gigue:[930,870,755],raccord:1e3,exigence:3}},{grid:`16421e95`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo1AIIBtgEqjgQylgQK7gdS`,ticks:316,entryTick:0,exitTick:309,fastest:309,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo1BIoB_gIwpQEMjQIK5gIazgdK`,ticks:302,entryTick:17,exitTick:296,fastest:280,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}}]},"descente-scies":{variants:[{grid:`7115a1e3`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAA0h5Gqgs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAE6h1Wqgs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`77a115e7`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEAmg9eqg5eygs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEEkg820g5Wggs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[875,790,745],raccord:1e3,exigence:3}},{grid:`3bde3553`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIA6hZOihM`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIE8hVemhM`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`e69500a3`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjMAuio`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjME4ik`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`72dcc3f7`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQAkg9mqg5mwgs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQEug5m-g5Oigs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`e545e603`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUAmh5mwgs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUE6h1Osgs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}}]},descente:{variants:[{grid:`4a1cf642`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAAwgEmug8`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAEigEm4gYmmgg`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`42a79a95`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEAyhQ`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEE-hM`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d4d4cc2d`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIAghg`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIEqhc`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0f508098`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjMAyhQ`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjME-hM`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"escalier-friable":{variants:[{grid:`1be7cff6`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MADCAWaqAqYB8gKOAYIDlgGCA6YFQg`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,890,780],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MASKAW6qAo4BkgNeqgKOAeoCbvIF`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,945,780],raccord:1e3,exigence:3}},{grid:`c6752c90`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQDCAWaiApYBggOWAYIDlgGCA6YFQg`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,850,750],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQSKAWayAn7aAn7CAo4BggNm8gU`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,940,730],raccord:1e3,exigence:3}},{grid:`ea4fafd2`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgCCAY4BwgKmAfICvgQq3ghC`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,995,915],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgSKAW6iApYBygLGBDLWCFI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,940,725],raccord:1e3,exigence:3}}]},"escalier-scies":{variants:[{grid:`d6e5c5a1`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjAAwgG2BRpumgKuAdoCtgH6As4EInaiAr4EMsYEKv4HSg`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[965,795,575],raccord:null,exigence:5},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjAEmgHWBDpu-gJ-ugKmBBquAcICvgHqAr4EEp4BsgKuCUI`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[1e3,905,535],raccord:1e3,exigence:5}},{grid:`1bb7e721`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjEAwgGmBRJumgLOAeICngHyAq4B6gK2AfoCvgQKjgGiArYJSg`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[885,735,505],raccord:null,exigence:5},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjEEigGuAfoCtgHqAtYEEn7KAqYBigP-A1LGBBJmsgKWAaoI`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[1e3,885,630],raccord:1e3,exigence:4}},{grid:`77573665`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjIA2gH2BCqGAYoDdtICpgHCApYFEnayAuYEGs4ECm6yBw`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[1e3,975,755],raccord:null,exigence:3},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjIEigG2AfICpgHiAsYECpYBwgK-AeICxgQqjgGSA8YEMsYHYg`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[1e3,890,660],raccord:1e3,exigence:4}},{grid:`dda0089d`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjMAwgHOBQpmggLWAeICngHyAqYB-gLGBCJ-qgLmBDKmCEo`,ticks:711,entryTick:0,exitTick:705,fastest:704,gigue:[960,825,540],raccord:null,exigence:5},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjMEqgHGBCKGAeICjgGyAr4EUqYEIoYB4gKGAcoC3gQipghC`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[1e3,985,825],raccord:1e3,exigence:3}}]},escalier:{variants:[{grid:`a9813758`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAAogGGAYID5gMqvgZi`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAEigFm4gLuAyLeBkI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,905],raccord:1e3,exigence:2}},{grid:`6a0dd683`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEAugF2-gLmAyq-BmI`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEEigFu2gLuAyLeBkI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,875],raccord:1e3,exigence:2}},{grid:`c0ff542e`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIAqgGGAfICpgG6CtYFag`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIEigF2-gKOAdIIxgdK`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d63bad47`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjMAqgF-ggPmAyq-BmI`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjMEigFu2gKGBAreBkI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,935],raccord:1e3,exigence:2}},{grid:`eea904c6`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjQAqgF-ggPmAzK2BmI`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjQEwgLuAyreCEI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"glace-cheminee":{variants:[{grid:`52485911`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWNoZW1pbmVlOjAAwgPeARIWLEVEErYBCh4kVSEUIZICRoIH`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[1e3,780,635],raccord:null,exigence:4},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWNoZW1pbmVlOjAE6gLeARIeJEVEGq4BCh4kRUFGsgIW8gY`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[995,770,635],raccord:1e3,exigence:4}},{grid:`50295757`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWNoZW1pbmVlOjEA0gPOAQoeFGU8Eq4BEh4UlQEKfvIBNtIG`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[1e3,980,855],raccord:null,exigence:2},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWNoZW1pbmVlOjEE6gLmAQoeHE1EErYBCh4khQEKfuIBNuIG`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[1e3,785,540],raccord:1e3,exigence:5}},{grid:`c9f3606b`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWNoZW1pbmVlOjIA0gPeAQoWJJUBCrYBChYkhQEKjgHiCA`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWNoZW1pbmVlOjIE8gLmAQoWHG0kGq4BCh4khQEKjgHiCA`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[1e3,1e3,815],raccord:1e3,exigence:3}}]},"glace-corniches":{variants:[{grid:`2eb9f470`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczowALoO`,ticks:231,entryTick:0,exitTick:224,fastest:224,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczowBOoFJtoH`,ticks:220,entryTick:17,exitTick:213,fastest:196,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`463be7ed`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczoxAJIP`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczoxBOoFJrII`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cb317da5`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczoyAOoP`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczoyBOoFJooJ`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`fd1432d7`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczozAJIP`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLWNvcm5pY2hlczozBKoGJvIH`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"glace-freinage":{variants:[{grid:`3e14f0fc`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjAAkgVO0gRmkgY`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjAEogReggVW-gU`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7fad3cdf`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjEAsgRW6gReggY`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjEE-gNG0gReigY`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`0b8903f2`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjIA8gVGwgVe-gU`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjIEkgWOBgldogY`,ticks:291,entryTick:17,exitTick:284,fastest:262,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`cebaaeed`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjMAigVWqgRW8gU`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjMEqgReigRmggY`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a88c372c`,arret:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjQAsgYWqgFkzgIQEibSBQ`,ticks:276,entryTick:0,exitTick:269,fastest:268,gigue:[875,805,600],raccord:null,exigence:4},elan:{code:`AQMXbW9kdWxlOmdsYWNlLWZyZWluYWdlOjQEsgRG2gUe4gU`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,780,665],raccord:1e3,exigence:4}}]},"glace-mur":{variants:[{grid:`e7859d6d`,arret:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjowAIoF7gIitgMShgHCCA`,ticks:338,entryTick:0,exitTick:331,fastest:333,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjowBPoCjgMShgHCAoYJQg`,ticks:306,entryTick:17,exitTick:299,fastest:283,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`04bdfd27`,arret:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjoxAKIBRoID5gIKngMihglC`,ticks:328,entryTick:0,exitTick:321,fastest:321,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjoxBKoDtgMKrgMK_gha`,ticks:316,entryTick:17,exitTick:309,fastest:292,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`86ac7b71`,arret:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjoyAKIBJCXaBMYCCv4CCp4JUg`,ticks:349,entryTick:0,exitTick:343,fastest:343,gigue:[965,885,670],raccord:null,exigence:4},elan:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjoyBOoEvgIKhgMKlglS`,ticks:322,entryTick:17,exitTick:316,fastest:299,gigue:[775,720,655],raccord:1e3,exigence:4}},{grid:`98fcef75`,arret:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjozAJoBjgGyA8YBkgHmAzKGCUI`,ticks:350,entryTick:0,exitTick:343,fastest:343,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmdsYWNlLW11cjozBIoFxgJSlgMSftII`,ticks:336,entryTick:17,exitTick:330,fastest:313,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}}]},"glace-promenade":{variants:[{grid:`62aa95d1`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZTowAKIEXsoDRvoEjgHSA1bSA06qBQ`,ticks:460,entryTick:0,exitTick:453,fastest:453,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZTowBIoBbsoGVtoDXrIETtIDRtIF`,ticks:450,entryTick:17,exitTick:443,fastest:426,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`a426be40`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZToxAKIEXsoDRooERtIF`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZToxBIoBZsIGTrIDTuIF`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`c4015265`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZToyAKIEZsIDRtIEPuoDRtIF`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZToyBIoBbsIGTuoDXtoDRtoF`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`e3972bfc`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZTozAKIEZsIDRpIERsoF`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXByb21lbmFkZTozBIoBbpoGRtIDTuoF`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"glace-relais":{variants:[{grid:`17e35026`,arret:{code:`AQMVbW9kdWxlOmdsYWNlLXJlbGFpczowAIoB_gTiBWbiA9YB0gM20gO-AgruAhKuCUo`,ticks:653,entryTick:0,exitTick:647,fastest:647,gigue:[795,795,710],raccord:null,exigence:4},elan:{code:`AQMVbW9kdWxlOmdsYWNlLXJlbGFpczowBJoCtgaSAcYFYuYESpYDIm7SAoYDCq4JOg`,ticks:654,entryTick:17,exitTick:648,fastest:619,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`8506ed37`,arret:{code:`AQMVbW9kdWxlOmdsYWNlLXJlbGFpczoxAG7SA6YBugWmAdID5gUylgHyAbYDMoYDMIYJSg`,ticks:669,entryTick:0,exitTick:662,fastest:662,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOmdsYWNlLXJlbGFpczoxBMoCtgYyhgYqbrID5gMyhgMytgMyhglC`,ticks:649,entryTick:17,exitTick:642,fastest:625,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`b166a64e`,arret:{code:`AQMVbW9kdWxlOmdsYWNlLXJlbGFpczoyAIYB6gOeAdIFpgUypgYqxgIwpgMSpgGqAoYBwgg`,ticks:690,entryTick:0,exitTick:683,fastest:685,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOmdsYWNlLXJlbGFpczoyBOoChgcKlgY6jgY69gIKngMSdsoC_ghS`,ticks:675,entryTick:17,exitTick:668,fastest:643,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"glace-saut-haut":{variants:[{grid:`5c489dbb`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDowAIIG5gda`,ticks:231,entryTick:0,exitTick:224,fastest:224,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDowBIoBlgHiA5YHWg`,ticks:220,entryTick:17,exitTick:213,fastest:196,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`51942f6e`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDoxAOIJxgVK`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDoxBIoBpgUy9gdK`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`92a1dc1e`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDoyAKIC1gUy5gZq`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDoyBIoBpgUy9gdK`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`40370085`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDozAJoJVtoG`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDozBLIIXuIG`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ff6fd169`,arret:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDo0AOIJxgVK`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOmdsYWNlLXNhdXQtaGF1dDo0BIoBpgUy9gdK`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"grande-scie":{variants:[{grid:`42f0de9f`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAA2gMO4gQOmgU`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,940,760],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAEigMO2gQOmgU`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,920,760],raccord:1e3,exigence:3}},{grid:`172d8193`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEA2gMOugUO8gU`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,775,535],raccord:null,exigence:5},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEE-gIOwgUO8gU`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,800,690],raccord:1e3,exigence:4}},{grid:`c960a85f`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIA4gMO2gQOmgU`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,910,690],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIEigMO2gQOmgU`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,905,780],raccord:1e3,exigence:3}},{grid:`ccac0a33`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjMA2gMOugUO8gU`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,740,635],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjMEggMOugUO8gU`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,770,620],raccord:1e3,exigence:4}},{grid:`aa3adf1f`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjQA2gMO4gQOmgU`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,915,780],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjQEigMO2gQWkgU`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,820,730],raccord:1e3,exigence:3}},{grid:`18cf0211`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjUA2gMO6gMWugc`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,845,695],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjUE-gIO6gMeugc`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,735,630],raccord:1e3,exigence:4}}]},"iles-friables":{variants:[{grid:`6b0aa634`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MADSAW6SA16CA2bSA6YBggU`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MASKAYYBwgNG8gJWqgOmAZIF`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`095100b2`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQDKAZ4BggOmAZoDrgGiA3aKA06KBA`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,975,935],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQSSAY4BsgN28gKmAaoDfoIDZooE`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,910],raccord:1e3,exigence:2}},{grid:`2dc14776`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MgDiAWaKA17iAnbiA54BigU`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,900],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MgSKAYYBwgNGggNGsgOmAYoF`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`45e40182`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwCiAbYBggO2AZoDngGyA3aKA0aSBA`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,995,870],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwSKAY4BmgOeAaoDdqIDdooDXooE`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`5bf44276`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NADCAcYBwgNG8gI-wgNOwgU`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NASKAY4B0gNGigM-qgNmugU`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}}]},"iles-scie":{variants:[{grid:`02ec991a`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTowAGKmAfoD5gLKAna6Bg`,ticks:297,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTowBJoBJvoCProDLtICNqoG`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,995,905],raccord:1e3,exigence:2}},{grid:`930bf039`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToxAOICDtoCZvoDLuIDNvoF`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToxBIoBNrIELtoCVoIENpIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,980,935],raccord:1e3,exigence:2}},{grid:`98865c4d`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToyAPIBNvoCLoIEFsICLooG`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToyBIoBFoIDXqoDNtICNqoG`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,990,890],raccord:1e3,exigence:2}},{grid:`93ed21f8`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTozANoCFuICRpIEDoIENvoF`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTozBIoBNpoELuoDHroDPpIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6b0a8533`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo0ALIBXuID_gLKAk7SBg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo0BJIBJooDVpoDHtoCRqIG`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`37a940af`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo1AKoBRoIEFtICHuIJ`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,990,980],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo1BIoBPqoDNmCCAiziCQ`,ticks:288,entryTick:17,exitTick:281,fastest:262,gigue:[1e3,990,980],raccord:1e3,exigence:1}}]},lucarne:{variants:[{grid:`994f591e`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MACSAVaiA06qA3a6Bw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,815,650],raccord:null,exigence:4},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MASKAUaKAn76A26aBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[895,750,530],raccord:1e3,exigence:5}},{grid:`181480d2`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQBifvICbtIDbrIH`,ticks:275,entryTick:0,exitTick:268,fastest:266,gigue:[1e3,1e3,920],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQSKAU6SAnbyA2aiBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,755,590],raccord:1e3,exigence:5}},{grid:`760351ce`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MgBydpIDVtoDbpoH`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,875],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MgSKAVbyAYYB2gOOAZoH`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[890,695,560],raccord:1e3,exigence:5}}]},marelle:{variants:[{grid:`5a4bb6e8`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MACKAw6iA64BigR-8gc`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MASKASbyA26aBmaCBw`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`131de9b2`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MQB6fpoFZsIHdroG`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MQSKASaKBW7CB36qBg`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`59815a4c`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MgCKAw7iAm6KBX7yBw`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MgSKASbyA2aqBmb6Bg`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`35414776`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MwDKAS76BHbSB27CBg`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MwSKASbiBG7qB36qBg`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`b3487386`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6NACqBD6KARC9ATaUATBEiQNSTsIDjgca1gH6BQ`,ticks:517,entryTick:0,exitTick:510,fastest:522,gigue:[890,905,885],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6NAT6Ar4BmgiOAaoG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"mur-friable":{variants:[{grid:`b63463d4`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAAogTuARJuRQouPDUJXQmNATw-ggI2mgU`,ticks:304,entryTick:0,exitTick:298,fastest:298,rapide:269,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAE0gO-ARImbCCGASJGJSCmAZoCLsoE`,ticks:273,entryTick:17,exitTick:266,fastest:249,rapide:246,gigue:[1e3,990,925],raccord:1e3,exigence:2}},{grid:`68a5b778`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEAkgSGAQhkES1OCg5NCBReEmUKRjy6An6KBA`,ticks:285,entryTick:0,exitTick:278,fastest:278,gigue:[1e3,770,605],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEEsgMuCm4KTCUKbgldCl4IZAklrgMKjgHqAw`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[650,605,500],raccord:1e3,exigence:5}},{grid:`114912a8`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIAkgSOAQhkCS0-ChZdCCRGEmUKpgGSBw`,ticks:285,entryTick:0,exitTick:278,fastest:278,gigue:[1e3,745,670],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIEugMeEnYqhAE9EnYRNU4SbhBsESW-B2I`,ticks:302,entryTick:17,exitTick:295,fastest:278,rapide:251,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`78a5d988`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjMAogSeASoIdAktLgouNQgsNjJlCl400gKWBEo`,ticks:295,entryTick:0,exitTick:289,fastest:289,rapide:278,gigue:[995,990,955],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjME6gOeATI0LRKGASE9LgpeEFwJJbYDMuYDYg`,ticks:293,entryTick:17,exitTick:286,fastest:269,rapide:251,gigue:[1e3,950,835],raccord:1e3,exigence:3}}]},"mur-seul":{variants:[{grid:`00ae395c`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAAigHeAjK2AxrmASrmBlo`,ticks:275,entryTick:0,exitTick:269,fastest:269,gigue:[1e3,1e3,940],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAEigGWAgreAwr2ARqGBzo`,ticks:264,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`fa64cd78`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEAogHmAhKOAxq2AQiyAo4CIoYHOg`,ticks:335,entryTick:0,exitTick:329,fastest:323,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEE2gHOARqWAxK2AZoClgIahgc6`,ticks:320,entryTick:17,exitTick:314,fastest:293,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`5cfbfab2`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIAogG2Awq2AxKOAeIC_gEq_gZC`,ticks:347,entryTick:0,exitTick:341,fastest:341,rapide:320,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIEmgGGAhCmAwpu0gKmAgreBmI`,ticks:317,entryTick:17,exitTick:311,fastest:294,gigue:[955,800,705],raccord:1e3,exigence:4}},{grid:`56d5165c`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjMAqgHuAgrmAiLWAQiqAo4CIoYHOg`,ticks:335,entryTick:0,exitTick:329,fastest:323,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjMEmgGGAgquAyKGAboChgIKhgc6`,ticks:316,entryTick:17,exitTick:310,fastest:293,gigue:[960,780,680],raccord:1e3,exigence:4}},{grid:`410dbc35`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjQAkgHWAhLWAxruASLmBlo`,ticks:275,entryTick:0,exitTick:269,fastest:269,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjQEqgH-AQrWAxLuARqGBzo`,ticks:264,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`d0eb2d70`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjUAkgHWAjKGAzLmAwgsZcYEYg`,ticks:282,entryTick:0,exitTick:275,fastest:275,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjUEigGGAjCWAwqeAYICICJExgEwigQ`,ticks:268,entryTick:17,exitTick:261,fastest:242,gigue:[1e3,940,810],raccord:1e3,exigence:3}}]},"mur-trous":{variants:[{grid:`ee4ec45f`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czowAKIBxgIyhgMyhgMyhgMifsICrggSJuICRsoFDuoCRroI`,ticks:750,entryTick:0,exitTick:743,fastest:744,gigue:[1e3,975,935],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czowBIoBtgIa_gIipgMajgGqApYBmgKmCBImggMmmgYe4gIOogg`,ticks:740,entryTick:17,exitTick:733,fastest:717,gigue:[980,950,900],raccord:1e3,exigence:2}},{grid:`d0bae3bf`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czoxANIBvgIa9gIqjgMijgMSrgMKtggaHsICPvoFDuICXroI`,ticks:750,entryTick:0,exitTick:743,fastest:743,gigue:[1e3,970,850],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czoxBKIB1gIyjgMKjgMQ5gM69gIaxgMihgGaBg7qAnaCB0b6AhbqBw`,ticks:814,entryTick:17,exitTick:807,fastest:780,gigue:[1e3,980,920],raccord:1e3,exigence:2}},{grid:`e9fbf235`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czoyALoB7gIK9gIijgMypgMKhgG6Av4FEm6iBFbyBg7yAlbCCA`,ticks:773,entryTick:0,exitTick:766,fastest:766,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czoyBIoB5gIqxgJalgMK_gIytgMqjgGqBVaqBEbSBjaKAz6yCA`,ticks:771,entryTick:17,exitTick:764,fastest:738,gigue:[1e3,990,930],raccord:1e3,exigence:2}},{grid:`be517c9b`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czozAMIBZOYBIKYDGo4DMoYDEL4DCs4GOiaaA1b6Bj76AhbyBw`,ticks:754,entryTick:0,exitTick:747,fastest:744,gigue:[1e3,995,930],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czozBIoB7gEoHZYDIpYDEq4DCp4DGq4BmgcOygI2wgY2-gIm8gc`,ticks:739,entryTick:17,exitTick:732,fastest:715,gigue:[1e3,995,955],raccord:1e3,exigence:1}},{grid:`a7d093b2`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czo0AJIB1gIqtgMKhgMilgMShgG6ArYICh66Aj6CBg6SAzaqCA`,ticks:749,entryTick:0,exitTick:742,fastest:744,gigue:[1e3,985,835],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czo0BIoBxgIq7gIytgMK_gIyrgMSfvoERqoETqoETvoDVtII`,ticks:745,entryTick:17,exitTick:738,fastest:717,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`cd0b2ddb`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czo1AKIBxgIyhgMilgMyhgMidsICjgYqXqIETqoGLqIFNsoG`,ticks:771,entryTick:0,exitTick:764,fastest:766,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czo1BIoBpgJK9gIqtgMK_gIytgMihgG6BUayBFaqBiaiBTbKBg`,ticks:770,entryTick:17,exitTick:763,fastest:738,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}}]},"paroi-friable":{variants:[{grid:`3091df75`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MADCAaYDSCyGAzKGAwquAwruB0o`,ticks:381,entryTick:0,exitTick:374,fastest:373,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MASqAqYCIqYDEo4BqgKWAYoC5gdK`,ticks:369,entryTick:17,exitTick:362,fastest:346,gigue:[1e3,995,960],raccord:1e3,exigence:1}},{grid:`bc652c6d`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQBybpoD7gIKhgMargMIpgMKpgMK7gdC`,ticks:468,entryTick:0,exitTick:461,fastest:462,gigue:[1e3,980,745],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQSiAt4CCvYCIo4DKo4DKo4DGtYHWg`,ticks:423,entryTick:17,exitTick:417,fastest:400,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`e15945e9`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MgDKAd4DCCymAxKGAwquAwruB0o`,ticks:381,entryTick:0,exitTick:374,fastest:373,gigue:[1e3,995,985],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MgSiArYCGp4DGq4BigKWAYIC9gdC`,ticks:369,entryTick:17,exitTick:362,fastest:346,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`16d19a55`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwDCAeYDCp4DIKYDCr4DCt4HQg`,ticks:380,entryTick:0,exitTick:373,fastest:373,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwSiAr4CEqYDEpYBmgKeAZoC3gc6`,ticks:368,entryTick:17,exitTick:362,fastest:346,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}}]},pendule:{variants:[{grid:`1d41c771`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MADqBE7KA0biBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MASyBFa6A0bKBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`13c22e84`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MQDiBE7SA0biBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MQSiAYYB8gVG8gc`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`80a1e2ec`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MgDqBEbSA0biBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MgSaBEbaA0bSBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`d7e5651a`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MwDqBEayBD6KBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MwSiAYYB8gVG8gc`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,945],raccord:1e3,exigence:2}},{grid:`4a66e837`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NADqBEbSA0biBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NASqBE7KA0bKBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`38153124`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NQCSBX7iAz76Bg`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NQS6BF6KBEbqBg`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},"petits-trous":{variants:[{grid:`e0eaaf71`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowAKoDFuICHvoEFtoCFqoG`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,990,970],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowBKIBDvoCXqIFHuICNroG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,975,940],raccord:1e3,exigence:2}},{grid:`9c0be2f4`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxAOoCFpIDZpIHDtICJroG`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,985,910],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxBIoBTqoERvIGHsoCJqoG`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,970,930],raccord:1e3,exigence:2}},{grid:`fde6a784`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyAKoEdqIDLtoETroEZvIG`,ticks:417,entryTick:0,exitTick:410,fastest:410,gigue:[1e3,975,960],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyBPIBRtoEZuoEVvIETtoG`,ticks:406,entryTick:17,exitTick:399,fastest:382,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`4a6d8121`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czozAJoDDvICZooHRvICHuoF`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czozBIoBTqIEVuoGNvICJuoF`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`6ce29527`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czo0AKoBRpoFJsICJqIDJooH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,985,980],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czo0BIoBJtIDFpIDZpoEHtIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,995,980],raccord:1e3,exigence:1}}]},"piliers-scie":{variants:[{grid:`9f278765`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTowAKoEhgUingHKCs4FCo4B6gOWAaoDJvoF`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,1e3,900],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTowBKoDpgUylgGCCTbaAk6KA54BogSWAbIDHuIF`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[950,945,820],raccord:1e3,exigence:3}},{grid:`a7e2e900`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToxAKoEhgU6lgGqBMYBqgfGAdICFrIDpgGyAx6CBg`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToxBKoDpgUylgGSCF6qAYYGCo4B8gPeAaIDJrIF`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`bd57f562`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToyALIEvgQ61gG6Cv4EMpYB6gPWAaIDHuoF`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToyBKoDpgUylgGCCTbqAk76AqYB4gPOAbIDDvIF`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[1e3,980,890],raccord:1e3,exigence:2}},{grid:`177e6495`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTozAKoEhgUqngHCCq4FIoYBwgPOAaIDJoIG`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,970,915],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTozBOoCDooDzgUq5gYiJqIEzgHKAh7yA36SAxb6BQ`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[1e3,950,835],raccord:1e3,exigence:3}},{grid:`fb1e3ba2`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo0AKoEhgUSngHaCv4EMpYBsgSGAaoDFvIF`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo0BKoDpgUylgGCCTbiAk6KA7YBigSWAboDHtIF`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[1e3,945,825],raccord:1e3,exigence:3}},{grid:`dc71a245`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo1AKoEhgUyngG6Cu4EIt4BggSWAaIJ`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo1BMoDhgUS7gGqCCYiJvICRoIDlgGqBI4Bmgk`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[935,820,775],raccord:1e3,exigence:3}}]},piliers:{variants:[{grid:`aadaf7dd`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MACyAw7KA4YBygR-sgY`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MASSAX6KBJYB0gSGAbIG`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`da04bc37`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQCCBBaCA07yAg7KAy6yAh6iBg`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[900,750,595],raccord:null,exigence:5},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQSKAa4B4gNe-gIe2gM-sgIeggY`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,990,790],raccord:1e3,exigence:3}},{grid:`99611d07`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MgDCAw6yA44BugSGAboG`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MgSiAXb6A54BygSGAboG`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1563275b`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MwDyAx6qAz7qAg6iA1a6Ag6iBg`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,955,750],raccord:null,exigence:3},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MwSKAaYB8gNWggMe6gMmmgIuigY`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[875,755,550],raccord:1e3,exigence:5}},{grid:`dff05069`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6NAC6Aw6aA9YB6gN28gY`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6NASiAXaCBJYBigRukgc`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}}]},"plafond-pics":{variants:[{grid:`e80f38a8`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowAOoDFqIDFqIDDtoCJoIH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,995,980],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowBIoDJvICPoIDDsoCRpoH`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,960,795],raccord:1e3,exigence:3}},{grid:`33e8198d`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxAIIEPsoDRroDLroDPpoH`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,955,775],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxBJIDLuIDNtIDLvIDPuoG`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,920],raccord:1e3,exigence:2}},{grid:`1ac07ef0`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyAOoDFroCTrIDFuoCLoIH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,945,915],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyBJIDFqoDHpoDHpoDNqIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`5fc12515`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczozAOoDLvIDPsoDLuIDLvoG`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,920],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczozBJIDLvoDPtoDPrIDNvoG`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,855],raccord:1e3,exigence:2}},{grid:`67f8189e`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczo0AOoDFqIDHpoDJtoCFvoG`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,985,930],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczo0BOICLqIDFooDLuoCLoIH`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,955,930],raccord:1e3,exigence:2}}]},plongeon:{variants:[{grid:`8b5d4915`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjAAajaqCe4EQg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[895,840,870],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjAEmgEO6gGRAdoBgAHiAu4FSg`,ticks:256,entryTick:17,exitTick:250,fastest:229,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`4bcba99e`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjEAajaCCv4DWg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[705,645,685],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjEEmgEO2gGJAcoBoAHSA44FSg`,ticks:257,entryTick:17,exitTick:250,fastest:229,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`6859b548`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjIAajaiCfYEQg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[805,780,815],raccord:null,exigence:3},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjIEmgEOggKBAboBgAGSA84FQg`,ticks:254,entryTick:17,exitTick:247,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`9572258c`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjMAaja6Cd4EQg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[660,625,690],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjMEigEOogKJAaIBiAGCA94FSg`,ticks:256,entryTick:17,exitTick:249,fastest:229,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`c666ebf6`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjQAkgEmogeuAcIBtgTKAQ`,ticks:278,entryTick:0,exitTick:271,fastest:271,rapide:246,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjQEkgEu8gGRAZIBkAGSAW6aAsYEag`,ticks:258,entryTick:17,exitTick:251,fastest:230,gigue:[985,920,835],raccord:1e3,exigence:3}},{grid:`2f48bb8b`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjUAggEmwgguugJBSg`,ticks:217,entryTick:0,exitTick:210,fastest:210,gigue:[705,605,575],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjUEigE2sgGRAdIBkAGCAzbiAw`,ticks:221,entryTick:17,exitTick:214,fastest:194,gigue:[1e3,975,895],raccord:1e3,exigence:2}}]},"pont-friable":{variants:[{grid:`94d74f40`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowAKoEJuICJvICLroI`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,990,960],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowBMIDLuoCPuoCHsII`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[970,960,935],raccord:1e3,exigence:2}},{grid:`57b90f55`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxANIDVoIGFsoCJooI`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxBJIDVpIGJsoCHuIH`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,945],raccord:1e3,exigence:2}},{grid:`6057996b`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyALIGRoIDJvIFJooH`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,970,990],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyBPoDTrIERvoFJooH`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`643dc599`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTozAKoE5gMqvgUa5gZC`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTozBNoD5gMypgUy1gIKXtoD`,ticks:328,entryTick:17,exitTick:321,fastest:304,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`f22fa0ef`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo0AKIEJoIDJuICLrII`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,975,960],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo0BPIDHsoCHoIDLroI`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,995,960],raccord:1e3,exigence:1}},{grid:`b49f0f79`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo1AOoDTuIFDtoCHpoI`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo1BJoDTtoF9gKqCA`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"pont-patrouille":{variants:[{grid:`3049bc28`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowAPoBHpICCdIBDooDftID5gQy9gQKbsICbrIC7gG6AjbKBQ`,ticks:646,entryTick:0,exitTick:639,fastest:639,gigue:[1e3,975,770],raccord:null,exigence:3},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowBIICngUq1gHCA-4EUs4ECo4B2gJeqgLmAboCLuIF`,ticks:635,entryTick:17,exitTick:629,fastest:612,gigue:[1e3,965,865],raccord:1e3,exigence:2}},{grid:`d9dc709e`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxAOIBNpoDDuoCvgGaBI4FKs4B4gKGAdICXqIC9gHCAka6BQ`,ticks:646,entryTick:0,exitTick:639,fastest:639,gigue:[1e3,860,605],raccord:null,exigence:4},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxBJoCpgVKrgGCBN4EKvYECm66Ama6AuYBwgImwgU`,ticks:635,entryTick:17,exitTick:629,fastest:612,gigue:[1e3,950,795],raccord:1e3,exigence:3}},{grid:`5ab78624`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyAMoBRpIDDsICzgUy5gQy9gHyAnbaAmaqAuYB0gIuwgU`,ticks:646,entryTick:0,exitTick:639,fastest:639,gigue:[955,820,660],raccord:null,exigence:4},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyBKoChgYqLooDzgG6Aw7CAo4B8gJeugJm-gHmAcoCJuoF`,ticks:635,entryTick:17,exitTick:629,fastest:612,gigue:[945,760,530],raccord:1e3,exigence:5}},{grid:`2ba29be2`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTozAK4B6gRu-gO-BQoW8gLWAeoCbrICbroC5gHSAh7iBQ`,ticks:649,entryTick:0,exitTick:642,fastest:642,rapide:639,gigue:[1e3,905,760],raccord:null,exigence:3},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTozBMoBngV6vgRq3gRingQijgHKAmbKAu4BsgJOmgU`,ticks:635,entryTick:17,exitTick:629,fastest:612,gigue:[1e3,975,850],raccord:1e3,exigence:2}}]},"puits-descente":{variants:[{grid:`aeda7bcd`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAAclbqA-kBqgIIvgRSbqoENqoINsIENqII`,ticks:670,entryTick:0,exitTick:663,fastest:663,rapide:642,gigue:[1e3,980,870],raccord:null,exigence:2},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAEigEOmgKJAYgBEcIBKJoGDtIDbooIZpIEXtoI`,ticks:646,entryTick:17,exitTick:639,fastest:622,gigue:[965,795,640],raccord:1e3,exigence:4}},{grid:`764b2ffd`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEAigFGkgEYEcIBoAEimQHCB26aBT7KCB7CBSaSCA`,ticks:700,entryTick:0,exitTick:694,fastest:694,rapide:679,gigue:[1e3,930,815],raccord:null,exigence:3},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEEigEOogLBAVjiB4YB4gRW-gd2mgRuigk`,ticks:681,entryTick:17,exitTick:674,fastest:655,gigue:[1e3,975,900],raccord:1e3,exigence:2}},{grid:`2df4f04f`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIAqgEemgIwOWBSWBFYggJW8gOWAeoENoIIJsIEJpII`,ticks:661,entryTick:0,exitTick:654,fastest:654,rapide:643,gigue:[880,755,690],raccord:null,exigence:4},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIEwgEOYGqJAZgB2ghGygNu4gguwgQ2sgg`,ticks:660,entryTick:17,exitTick:653,fastest:636,rapide:622,gigue:[1e3,990,875],raccord:1e3,exigence:2}},{grid:`fbe46627`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjMA2gEOkgEIOcIBMLEBEiGyB3aiBTaKCE66BSbiBw`,ticks:687,entryTick:0,exitTick:680,fastest:680,rapide:679,gigue:[980,960,880],raccord:null,exigence:2},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjMEmgEOigKRAXAhsgEoigZ24gRm6gde-gZu2gY`,ticks:682,entryTick:17,exitTick:675,fastest:655,gigue:[920,805,600],raccord:1e3,exigence:4}}]},puits:{variants:[{grid:`60c27f29`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjAAajbaA-kBaCo4ggNOugU`,ticks:276,entryTick:0,exitTick:269,fastest:269,gigue:[770,605,540],raccord:null,exigence:5},elan:{code:`AQMObW9kdWxlOnB1aXRzOjAEigEO0gNp8AIiCPoBRpIG`,ticks:277,entryTick:17,exitTick:271,fastest:254,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`671f3e57`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjEAugEW8gFAIYAEugJe2gU`,ticks:272,entryTick:0,exitTick:265,fastest:263,gigue:[745,680,685],raccord:null,exigence:4},elan:{code:`AQMObW9kdWxlOnB1aXRzOjEEmgEOggLRApoCSLIBdtIF`,ticks:264,entryTick:17,exitTick:257,fastest:241,gigue:[1e3,975,975],raccord:1e3,exigence:1}},{grid:`9f0fd7fe`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjIAcj7qBHHiAnbyBQ`,ticks:264,entryTick:0,exitTick:257,fastest:253,gigue:[1e3,845,675],raccord:null,exigence:4},elan:{code:`AQMObW9kdWxlOnB1aXRzOjIEmgEOIKoBTDkSSHGYAdIBGYIBjgHqBQ`,ticks:260,entryTick:17,exitTick:254,fastest:237,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`7544a537`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjMAggEmogRhwAHqCA`,ticks:265,entryTick:0,exitTick:258,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjMEigEmIEEiWCJsxQHiAUCyCA`,ticks:259,entryTick:17,exitTick:252,fastest:235,gigue:[750,655,720],raccord:1e3,exigence:3}}]},quinconce:{variants:[{grid:`e6c257b5`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowAIIDNvoDLroDRtIH`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,920,800],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowBMoCNsoDNsoDPtoH`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,1e3,795],raccord:1e3,exigence:3}},{grid:`26ba8d4b`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxANoDPvIEPvoDVtII`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,840],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxBIoBlgGaBj7iA2bSCA`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`f61b9116`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToyANoDPpoGbuoEZrIJ`,ticks:417,entryTick:0,exitTick:410,fastest:410,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToyBIoBlgGSB2bCBVaaCQ`,ticks:406,entryTick:17,exitTick:399,fastest:382,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1a10ac83`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTozAMoDPvoERvIDXtII`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTozBKIBbqIGRtoDZtoI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`c9f943da`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo0AMoDPvoERtoDbtoI`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo0BIoBlgHKBW76A17iCA`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`64235541`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo1ALIDNrIDProDTtIH`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,960,655],raccord:null,exigence:4},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo1BMICNroDTsoDTsoH`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,970,740],raccord:1e3,exigence:3}}]},"rebonds-doux":{variants:[{grid:`73bcad3e`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDowAOICJuICRuICJvIF`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDowBIoBJqIEJsICJvIF`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`264cfd35`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoxAOIBJsIEJuIEJooG`,ticks:285,entryTick:0,exitTick:279,fastest:279,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoxBIoBJsIEJuIEJpIG`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6588769d`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoyAOIBJoIFRuICJoIG`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoyBIoBJuIDJoIEJqIG`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`52a8f1e4`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDozAOICJuICRuICJvIF`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDozBIoBJqIEJsICJvIF`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-mur-iles":{variants:[{grid:`ed474f4e`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MABKfjDWBTqOAaoC_gIy5gQ6ZrID3gLCA1baAib6AhbyBw`,ticks:714,entryTick:0,exitTick:707,fastest:700,gigue:[1e3,1e3,940],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MATKAtYCMoYDCq4DCq4DCr4FGlaCA0bSAg7CAz66Ag6KAxaSCA`,ticks:729,entryTick:17,exitTick:722,fastest:705,gigue:[1e3,1e3,890],raccord:1e3,exigence:2}},{grid:`b38aa751`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQAqlgE41gUipgGaAq4DCuYEKm6yA06yAzbCA07iAg6KAy6iCA`,ticks:746,entryTick:0,exitTick:739,fastest:732,gigue:[1e3,990,895],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQTKAvYCCo4DCq4DCq4DCs4FGkbyAl7aAy7aA0aCA94Dwgc`,ticks:761,entryTick:17,exitTick:754,fastest:738,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`d68ff1d5`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgCqAT7SBZ4DGqYDCs4FGj7SA64BwgQ-ygIesgMmygc`,ticks:705,entryTick:0,exitTick:698,fastest:700,gigue:[1e3,975,860],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgSqAoYDEp4DEqYDCp4DCqYFMlbKA7YBkgU2kgI2qgMmwgc`,ticks:729,entryTick:17,exitTick:722,fastest:705,gigue:[1e3,965,780],raccord:1e3,exigence:3}},{grid:`8bbe858e`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MwCyATbiBYYDKqYDCtYFGkaKA076Ax7KAzbqAg6aAy7aBw`,ticks:739,entryTick:0,exitTick:732,fastest:732,gigue:[1e3,985,815],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MwTKAtYCEqYDCq4DCq4DCsYFIkaCA1baAybaA0aCAyaKAzbCBw`,ticks:761,entryTick:17,exitTick:754,fastest:738,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`b4728776`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NACqBEjKAqYBigKmAZICfooFNoIDlgMQIigSCSIZsgIusgNusgk`,ticks:707,entryTick:0,exitTick:700,fastest:700,gigue:[1e3,950,705],raccord:null,exigence:4},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NATqAt4CCqYDCp4DCp4DGoYB-gQ-sgOuA_oCRrIDPuIJ`,ticks:729,entryTick:17,exitTick:722,fastest:705,gigue:[1e3,985,900],raccord:1e3,exigence:2}}]},"ressort-mur":{variants:[{grid:`eb6cc4f3`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAAsgEd8go`,ticks:199,entryTick:0,exitTick:192,fastest:195,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAE4gs`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`293c6639`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEAugEdwgs`,ticks:210,entryTick:0,exitTick:203,fastest:206,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEEsgw`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0abc9aa7`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjIAogEUHfoK`,ticks:200,entryTick:0,exitTick:194,fastest:195,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjIE4gs`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`946a9549`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjMAsgEtogYYIZABRvID`,ticks:222,entryTick:0,exitTick:215,fastest:215,gigue:[990,790,730],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjME0gceygQ`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1223a2f6`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjQAogEMJYIL`,ticks:201,entryTick:0,exitTick:194,fastest:195,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjQE4gs`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-plafond":{variants:[{grid:`e5247a65`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowAMIBRooL`,ticks:209,entryTick:0,exitTick:202,fastest:202,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowBJIBfqoK`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cfcfbc16`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxAJIBhgxS`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxBJIBhgH6Cg`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,920],raccord:1e3,exigence:2}},{grid:`e43aee9c`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyAMoBngUqjgMKjgEKLroF`,ticks:273,entryTick:0,exitTick:267,fastest:267,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyBLoBngUapgJRhgEiJrIF`,ticks:265,entryTick:17,exitTick:258,fastest:246,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`8278a5fa`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDozAJIBhgxS`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDozBIoBhgGCCw`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,900],raccord:1e3,exigence:2}},{grid:`ff58a4a1`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDo0AMIBRoIDxgdK`,ticks:209,entryTick:0,exitTick:202,fastest:202,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDo0BIoBRoIDpgdK`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-scie":{variants:[{grid:`eb496a82`,arret:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZTowANoDcDSVAQqeB0o`,ticks:222,entryTick:0,exitTick:215,fastest:215,rapide:206,gigue:[1e3,990,800],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZTowBPoCeCyNAQ4Kpgc6`,ticks:209,entryTick:17,exitTick:203,fastest:186,rapide:177,gigue:[1e3,800,690],raccord:1e3,exigence:4}},{grid:`e8bf549c`,arret:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZToxAOICpgMhqgc`,ticks:217,entryTick:0,exitTick:210,fastest:209,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZToxBPoBDtIL`,ticks:218,entryTick:17,exitTick:211,fastest:194,rapide:178,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`846fa2ba`,arret:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZToyANIC_gGIAaoG`,ticks:191,entryTick:0,exitTick:184,fastest:184,gigue:[805,675,640],raccord:null,exigence:4},elan:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZToyBJoCzgFIWcoG`,ticks:185,entryTick:17,exitTick:178,fastest:161,gigue:[1e3,985,945],raccord:1e3,exigence:2}}]},"ressorts-escalier":{variants:[{grid:`9cb6481d`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAAmgEOsgEwSTiCAyBBIqgBGUJgggRB2gk`,ticks:399,entryTick:0,exitTick:392,fastest:393,gigue:[1e3,995,985],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAEqgLmAwqeBCSmDkI`,ticks:405,entryTick:17,exitTick:398,fastest:381,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ae596312`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEAygEN6gUoQYIBIEHiBCBB8gk`,ticks:406,entryTick:0,exitTick:399,fastest:402,gigue:[1e3,990,965],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEEygKWBAruBDAxqg8`,ticks:442,entryTick:17,exitTick:435,fastest:414,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c6fc9037`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIAkgEO6gFREKIDIEEisAEROmiCBEHCCQ`,ticks:396,entryTick:0,exitTick:389,fastest:393,gigue:[1e3,980,965],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIEqgLmAwqeBCSmDkI`,ticks:405,entryTick:17,exitTick:398,fastest:381,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c2790a02`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMAqgEl4gUwSYIBIEHiBCBBggo`,ticks:408,entryTick:0,exitTick:401,fastest:402,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMEygKWBAruBDAxqg8`,ticks:442,entryTick:17,exitTick:435,fastest:414,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ba43d2f9`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQAei6yASBZGMIDQRqwASE6IIIEgQHiCQ`,ticks:400,entryTick:0,exitTick:393,fastest:393,gigue:[1e3,970,880],raccord:null,exigence:2},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQEqgLmAwqeBCSmDkI`,ticks:405,entryTick:17,exitTick:398,fastest:381,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressorts-trous":{variants:[{grid:`ade9e5f0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAEmgQO8hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`194428b0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEEogQO6hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`8fcee7f0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjIAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjIEmgQO8hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`f1e426b0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjMAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjMEogQO6hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}}]},"saut-long":{variants:[{grid:`6d93ca6a`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowAOoHNvoG`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowBMIGVqoH`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`24b0d8be`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxAOoHbpoH`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxBJIHXqoH`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`f9e395cf`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyAOIHhgHiBw`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyBIoHhgHiBw`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`3b4e8b39`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzozAPoGXsIH`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzozBMoGTqoH`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`448dccfe`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo0AOoHbpoH`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo0BJIHXqoH`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`db27e451`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo1AMoGHrII`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo1BLoFTroI`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"saut-plafond":{variants:[{grid:`fb40d9d4`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDowAKoE9gUi1gc6`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDowBNoD3gUyvgda`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`da9f51ee`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoxAIIF1gYavgdS`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoxBKoE5gYargda`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`54a30d00`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoyALoELroFPvIH`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,940],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoyBNIDPtoFNuIH`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,930],raccord:1e3,exigence:2}},{grid:`884e5a34`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDozAKoE9gUqxgdC`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDozBNoD3gUyvgda`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`75936bd0`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDo0AIIFrgYK_gdK`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDo0BKoElgYq9gdS`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-ronde":{variants:[{grid:`10b2c80e`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MACCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MASyCS4KLqIE`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`78ae81a0`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQCCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQSyCS7SBA`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7e67a8c5`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgCCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgSyCS4KLqIE`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`816f2382`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MwCCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MwSyCS7SBA`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`5983d997`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6NACCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6NATKBCbKCQ`,ticks:230,entryTick:17,exitTick:223,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`4586d452`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6NQDCBybaAw`,ticks:183,entryTick:0,exitTick:176,fastest:176,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6NQTqBibaAw`,ticks:172,entryTick:17,exitTick:165,fastest:148,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-sol":{variants:[{grid:`9fb722ea`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAAggaWBDLGB0I`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAEogWWBDq-B1I`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6381d1a2`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEAogXmAzLWCEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEEygTuAyLeCEo`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`66257bc6`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIAugbWBDLWBjo`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIE-gXGBDK2Blo`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`da14bc56`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjMAkgTWAiKeAyLWBzo`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjMEwgPWAhqmAyLGB0o`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`aec748a4`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjQAogXmAzLWCEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjQEygSmBQq2B1I`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`834bf66e`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjUAogXmAzLWCEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjUEygT2AxLmCEo`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},"scies-jumelles":{variants:[{grid:`691777e5`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAAqgKeBSL-B2o`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAE4gHeAdIDpghC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7cbeccc5`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEAogKGBjKWB2I`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEE-gKWAeIDxgdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d7c8087d`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIA4gLWAdoDlgGqBw`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIEkgLOAeoD7gdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`f53a9ae7`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjMAqgKeBSL-B2o`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjME4gHWAdoDpghC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6d934606`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjQA4gLWAcoDpgGqBw`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjQEmgLOAdoD9gdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`a13cdb87`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjUAogKGBjKWB2I`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjUE-gKWAeIDxgdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"tapis-alternes":{variants:[{grid:`6778393a`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjAA6gJmogRO-gU`,ticks:229,entryTick:0,exitTick:222,fastest:218,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjAEugJWigT-AtACWg`,ticks:214,entryTick:17,exitTick:208,fastest:190,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`986a9b99`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjEA6gJmogROggQ2ogI2ogIxYg`,ticks:300,entryTick:0,exitTick:293,fastest:293,gigue:[550,595,645],raccord:null,exigence:4},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjEE2gI-ggRWwgRG0gU`,ticks:294,entryTick:17,exitTick:287,fastest:269,gigue:[1e3,1e3,935],raccord:1e3,exigence:2}},{grid:`641f6a24`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjIA6gJmogRWygQ-0gI5av4C0AJK`,ticks:375,entryTick:0,exitTick:369,fastest:371,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjIEugJW6gNmmgRWigT-AtACWg`,ticks:364,entryTick:17,exitTick:358,fastest:343,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c8e0359f`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjMAqgNO-gNWygRmggU`,ticks:300,entryTick:0,exitTick:293,fastest:294,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWFsdGVybmVzOjMEugJW2gNu6gRWmgU`,ticks:291,entryTick:17,exitTick:284,fastest:267,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"tapis-contraire":{variants:[{grid:`a9056276`,arret:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZTowANIBFqoCDqoCbqIDRuoE`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,935,820],raccord:null,exigence:3},elan:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZTowBIoBJqoCDtICZqIDJtIE`,ticks:243,entryTick:17,exitTick:236,fastest:219,gigue:[1e3,895,840],raccord:1e3,exigence:3}},{grid:`322de302`,arret:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZToxAJIBNtICDqICXvICHsoCJpoE`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,935,720],raccord:null,exigence:3},elan:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZToxBJIBNqoCDuICPvICFvIBNqIE`,ticks:265,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,960,825],raccord:1e3,exigence:3}},{grid:`fa18f76c`,arret:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZToyACIOsgKYAdIBbroDngEKECHCAiaCBA`,ticks:290,entryTick:0,exitTick:283,fastest:283,rapide:281,gigue:[890,755,565],raccord:null,exigence:5},elan:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZToyBIoBPiqZAQrMAVKGAeIDpgHiAi6qBA`,ticks:298,entryTick:17,exitTick:291,fastest:274,rapide:260,gigue:[975,785,575],raccord:1e3,exigence:5}},{grid:`affeaf1c`,arret:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZTozAKoBVtICDsoChgH6Ala6BQ`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnRhcGlzLWNvbnRyYWlyZTozBIoBTsoCHqICfvICZrIF`,ticks:265,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,990,935],raccord:1e3,exigence:2}}]},"tapis-escalier":{variants:[{grid:`05695a18`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjAA0gGGAYIDxgQiZqoD`,ticks:231,entryTick:0,exitTick:224,fastest:224,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjAEigGGAYoDzgQiVqID`,ticks:221,entryTick:17,exitTick:214,fastest:197,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`12154506`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjEAggGuAaIDzgQaZooE`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjEEigGGAZoDvgQabuoD`,ticks:232,entryTick:17,exitTick:225,fastest:208,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`8f19e50f`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjIAwgFm8gJu-gI2mgJuygM`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[985,875,690],raccord:null,exigence:4},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjIEqgF2-gKOAvoBNqICZvIC`,ticks:246,entryTick:17,exitTick:239,fastest:222,rapide:219,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`8d50f7c4`,arret:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjMAggHOAZoDzgHaAkbSBA`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnRhcGlzLWVzY2FsaWVyOjMEigGOAZID3gHSAh7iBA`,ticks:232,entryTick:17,exitTick:225,fastest:208,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}}]},"tapis-lance":{variants:[{grid:`7620684a`,arret:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjAAggYu2gJukgU`,ticks:239,entryTick:0,exitTick:232,fastest:230,gigue:[1e3,965,880],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjAEkgU-8gJekgU`,ticks:228,entryTick:17,exitTick:221,fastest:203,gigue:[1e3,870,790],raccord:1e3,exigence:3}},{grid:`a8793c33`,arret:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjEAkgbGAeoF`,ticks:215,entryTick:0,exitTick:209,fastest:211,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjEEugXGAfIF`,ticks:205,entryTick:17,exitTick:198,fastest:184,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`44f655d7`,arret:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjIA0gVmsgOWAZoF`,ticks:257,entryTick:0,exitTick:250,fastest:248,gigue:[1e3,970,850],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjIEmgVeigPWBWo`,ticks:246,entryTick:17,exitTick:239,fastest:221,gigue:[1e3,915,835],raccord:1e3,exigence:3}},{grid:`2c9b6302`,arret:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjMAigYu0gK2AfoF`,ticks:261,entryTick:0,exitTick:254,fastest:252,gigue:[1e3,950,845],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOnRhcGlzLWxhbmNlOjMEkgU-ggPGBko`,ticks:250,entryTick:17,exitTick:243,fastest:225,gigue:[1e3,900,825],raccord:1e3,exigence:3}}]},"tapis-mur":{variants:[{grid:`e8b7a737`,arret:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjowAPIB3gMKrgGiAv4ISg`,ticks:299,entryTick:0,exitTick:292,fastest:293,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjowBMoBpgGCAXY0wgL-CEo`,ticks:273,entryTick:17,exitTick:266,fastest:250,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`f98f2a15`,arret:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjoxAKoBNoID1gEahgMihglK`,ticks:309,entryTick:0,exitTick:303,fastest:303,gigue:[1e3,955,880],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjoxBPoBvgISlgMKpgGyCA`,ticks:277,entryTick:17,exitTick:271,fastest:250,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6dfbd6bb`,arret:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjoyAJIFzgIKhgMKnglK`,ticks:329,entryTick:0,exitTick:323,fastest:323,gigue:[1e3,880,660],raccord:null,exigence:4},elan:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjoyBLoCvgIa_gIKpglK`,ticks:286,entryTick:17,exitTick:280,fastest:263,gigue:[1e3,855,735],raccord:1e3,exigence:3}},{grid:`1aff5cdb`,arret:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjozAIYGGs4BQoYDGo4Bygg`,ticks:337,entryTick:0,exitTick:331,fastest:331,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnRhcGlzLW11cjozBIICvgGyAYYDIoYBygg`,ticks:282,entryTick:17,exitTick:276,fastest:259,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},"tapis-relais":{variants:[{grid:`4e3584fd`,arret:{code:`AQMVbW9kdWxlOnRhcGlzLXJlbGFpczowANoBZqIDRsICDroCjgGSAw6yAl6iBC66BYYB4gUe6gK-AZoF`,ticks:718,entryTick:0,exitTick:711,fastest:711,rapide:693,gigue:[905,795,575],raccord:null,exigence:5},elan:{code:`AQMVbW9kdWxlOnRhcGlzLXJlbGFpczowBLIBXpIDTvICDuIC1gGiA2biAg7SAlbaBIYBggVOqgO-AbIF`,ticks:712,entryTick:17,exitTick:705,fastest:688,rapide:665,gigue:[1e3,945,705],raccord:1e3,exigence:4}},{grid:`a1aca0be`,arret:{code:`AQMVbW9kdWxlOnRhcGlzLXJlbGFpczoxAMoBXpoDHqoCLroCtgHKA0aKAy7yAk6aBZYBogU28gKWAbIE`,ticks:692,entryTick:0,exitTick:685,fastest:685,gigue:[795,690,560],raccord:null,exigence:5},elan:{code:`AQMVbW9kdWxlOnRhcGlzLXJlbGFpczoxBJoBVqIDJpIDDroDvgHKAx66AibKApYB6gSOAdIFDsoChgHCBQ`,ticks:706,entryTick:17,exitTick:699,fastest:682,rapide:658,gigue:[1e3,965,810],raccord:1e3,exigence:3}},{grid:`0d03b73f`,arret:{code:`AQMVbW9kdWxlOnRhcGlzLXJlbGFpczoyAIIBJuICJsICJroCHtICbpoDDqICVooDZqIFhgGCBWaiA8YFUg`,ticks:710,entryTick:0,exitTick:703,fastest:703,gigue:[945,810,570],raccord:null,exigence:5},elan:{code:`AQMVbW9kdWxlOnRhcGlzLXJlbGFpczoyBIoBLtoCFpICDroCDqoCxgG6Aw6yAkbaAh6yBZYB-gU26gKuAfIE`,ticks:700,entryTick:17,exitTick:693,fastest:676,gigue:[930,745,610],raccord:1e3,exigence:4}}]},"tapis-respiration":{variants:[{grid:`1b13ce8e`,arret:{code:`AQMabW9kdWxlOnRhcGlzLXJlc3BpcmF0aW9uOjAA4gRm4gOGAeIDRuICQUI`,ticks:292,entryTick:0,exitTick:285,fastest:285,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnRhcGlzLXJlc3BpcmF0aW9uOjAEqgOWAZIEZpIENuoD`,ticks:282,entryTick:17,exitTick:275,fastest:258,gigue:[1e3,1e3,930],raccord:1e3,exigence:2}},{grid:`bf89005a`,arret:{code:`AQMabW9kdWxlOnRhcGlzLXJlc3BpcmF0aW9uOjEA4gRm4gOGAfIDduIDRsICQWI`,ticks:368,entryTick:0,exitTick:361,fastest:360,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnRhcGlzLXJlc3BpcmF0aW9uOjEEqgOWAZIEZuIDZsoELtICMVI`,ticks:357,entryTick:17,exitTick:350,fastest:333,gigue:[1e3,945,855],raccord:1e3,exigence:2}}]},toboggan:{variants:[{grid:`f21c0c1f`,arret:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjAAsgQ26gRGggVukgg`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,910,615],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjAEwgNGwgRuogWGAeIH`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,950,795],raccord:1e3,exigence:3}},{grid:`719561ed`,arret:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjEAsgQ22gRWogV26gc`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,920,755],raccord:null,exigence:3},elan:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjEE2gM28gRGkgWWAdIH`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,925,745],raccord:1e3,exigence:3}}]},tremplin:{variants:[{grid:`e4a1699e`,arret:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjAAogSGAaIGlgHSCA`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjAEygOuAaIGpgGiCA`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`9cc06aee`,arret:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjEAogSGAcIGZuII`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjEEqgOWAfIGhgGqCA`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`51c53a91`,arret:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjIAogSGAaoGlgHKCA`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjIEygOeAbIGngGqCA`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"tunnel-scies":{variants:[{grid:`645a66bb`,arret:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczowAMIBFvoCPoIDboIDvgMqLvoCXsICfvoCDuoClgEKbiUKHkQKHmQJHWYKPmUKRgq2ASKGBVI`,ticks:686,entryTick:0,exitTick:679,fastest:678,gigue:[1e3,1e3,910],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczowBNICdqoD1gNKhgSKA0bCA6YDCh7CAqYBCl4lCn4KHmQJHWYKHkQlCl4KXiUJHSTmBEI`,ticks:669,entryTick:17,exitTick:662,fastest:645,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`9033a3f0`,arret:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczoxAIIFpgNKngMy5gMixgMazgMa3gMangEsCl4JTRQILD4ILDUILD4IJE0IFFYJTSYKpgG6BA`,ticks:662,entryTick:0,exitTick:655,fastest:655,gigue:[810,900,735],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczoxBNoCdqID5gQi5gMixgPyA9YDIr4BCkYSNlwKZgomXApmCiYsLQpeCkYhGrYBogQ`,ticks:659,entryTick:17,exitTick:652,fastest:631,gigue:[1e3,890,790],raccord:1e3,exigence:3}}]},tunnel:{variants:[{grid:`54d03cf7`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDowAKIEdtoD3gVS`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,925],raccord:null,exigence:2},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDowBIoBbqoD1gIKLqIG`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`b750aa6e`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoxAKIEdqIH`,ticks:198,entryTick:0,exitTick:191,fastest:191,gigue:[1e3,1e3,890],raccord:null,exigence:2},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoxBIoBbvoCtgZK`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a9f6ba5c`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoyAKIEbqoH`,ticks:198,entryTick:0,exitTick:191,fastest:191,gigue:[1e3,1e3,890],raccord:null,exigence:2},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoyBIoBZoIDtgZK`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`c764abed`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDozANoB9gIq1gIy5gZC`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDozBKIBhgHyAi6SA4YB8gQ`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]}}},pt=[`mural`,`precision`,`vertical`,`scie`,`friable`,`ressort`,`respiration`,`tapis`,`glace`],mt=[`plafond`,`fosse`,`sol-friable`,`patrouille`,`garde`,`ressort`,`denivele`,`surface`],ht=[`arret`,`elan`],X=class extends Error{constructor(e){super(e),this.name=`ModuleError`}},gt=new Set([`id`,`intention`,`etiquettes`,`famille`,`theme`,`enchainement`,`elan`,`mutateurs`,`format`,`paliers`,`repeter`,`variante`]),_t=`<>^v`;function vt(e){let t=/^(\d+)(?:-(\d+))?$/.exec(e);if(!t)return null;let n=Number(t[1]),r=t[2]===void 0?n:Number(t[2]);return n<=r?[n,r]:null}function yt(e,t,n,r){let i=e[1];mt.includes(i)||r(`zone « ${e[1]} » : mutateur inconnu (${mt.join(`, `)})`);let a=e=>{let n=e===void 0?null:vt(e);return(!n||n[1]>=t)&&r(`zone ${i} : colonnes « ${e} » hors du gabarit`),n},o=e=>{let t=e===void 0?null:vt(e);return(!t||t[1]>=n)&&r(`zone ${i} : rangées « ${e} » hors du gabarit`),t},s=(e,t,n=``)=>({name:i,c0:e[0],c1:e[1],r0:t[0],r1:t[1],extra:n});switch(i){case`plafond`:case`fosse`:case`sol-friable`:case`ressort`:case`surface`:return e.length!==4&&r(`« zone ${i} <colonnes> <rangée> » attendu`),s(a(e[2]),o(e[3]));case`garde`:return(e.length!==5||e[4].length!==1||!_t.includes(e[4]))&&r(`« zone garde <colonnes> <rangées> <pic : < > ^ v> » attendu`),s(a(e[2]),o(e[3]),e[4]);case`denivele`:{e.length!==3&&r(`« zone denivele <colonnes> » attendu`);let i=a(e[2]);return i[1]!==t-1&&r(`zone denivele : elle va jusqu'à la dernière colonne (la sortie)`),s(i,[0,n-1])}case`patrouille`:return e.length<7&&r(`« zone patrouille <rayon> <cycle> <mode> <c,r> <c,r>… » attendu`),s([0,t-1],[0,n-1],e.slice(2).join(` `))}}var bt=/^[#.^v<>oOx*[\]~]+$/;function xt(e){let t=e.replace(/\r/g,``).split(`
`),n=0,r={};for(;n<t.length;n++){let e=t[n].trim();if(e===``||e.startsWith(`//`))continue;if(e===`grille:`)break;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(!i||!gt.has(i[1]))throw new X(`Ligne ${n+1} : « clé: valeur » attendu (${[...gt].join(`, `)}, puis « grille: »)`);(r[i[1]]??=[]).push(i[2].trim())}if(n>=t.length)throw new X(`« grille: » manquant`);let i=e=>{let t=r[e];if(!t||t.length!==1||t[0]===``)throw new X(`« ${e}: » attendu une fois`);return t[0]},a=i(`id`);if(!/^[a-z0-9-]{1,24}$/.test(a))throw new X(`id « ${a} » invalide (minuscules, chiffres, tirets, 24 au plus)`);let o=e=>`Morceau « ${a} » : ${e}`,s=i(`intention`),c=i(`etiquettes`).split(/\s+/);for(let e of c)if(!pt.includes(e))throw new X(o(`étiquette « ${e} » inconnue (${pt.join(`, `)})`));if(new Set(c).size!==c.length)throw new X(o(`étiquette en double`));if(i(`format`)!==`3`)throw new X(o(`format ${i(`format`)} : seul le format 3 (paliers posés, famille et mutateurs, lot 7) est lu`));let l=i(`famille`);if(!/^[a-z0-9-]{1,24}$/.test(l))throw new X(o(`famille « ${l} » invalide (minuscules, chiffres, tirets)`));let u=r.theme===void 0?null:i(`theme`);if(u!==null&&!at.includes(u))throw new X(o(`theme « ${u} » inconnu (${at.join(`, `)})`));let d=u;for(let[e,t]of[[`tapis`,`usine`],[`glace`,`glace`]])if(c.includes(e)!==(d===t))throw new X(o(`l'étiquette « ${e} » et « theme: ${t} » vont ensemble`));let f=(e,t)=>{let n=r[e];if(!n)return!1;if(n.length!==1||n[0]!==t)throw new X(o(`« ${e}: ${t} » attendu (ou rien)`));return!0},p=f(`enchainement`,`long`),m=f(`elan`,`oui`),h=(r.mutateurs??[]).flatMap(e=>e.split(/\s+/)).filter(Boolean);for(let e of h)if(!mt.includes(e))throw new X(o(`mutateur « ${e} » inconnu (${mt.join(`, `)})`));if(new Set(h).size!==h.length)throw new X(o(`mutateur en double`));let g=/^(\d+)\s+(\d+)$/.exec(i(`paliers`));if(!g)throw new X(o(`« paliers: <rangée du sol à l'entrée> <rangée du sol à la sortie> » attendu`));n++;let _=[];for(;n<t.length&&t[n].trim()!==``;n++)_.push(t[n].trim());let y=t.slice(n).map(e=>e.trim()).filter(e=>e!==``&&!e.startsWith(`//`)),b=y.filter(e=>!e.startsWith(`zone `));if(_.length===0)throw new X(o(`grille vide`));let x=_[0].length;_.forEach((e,t)=>{if(e.length!==x)throw new X(o(`rangée ${t} : ${e.length} colonnes au lieu de ${x}`));if(!bt.test(e))throw new X(o(`rangée ${t} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`))});let S=Number(g[1]),C=Number(g[2]);if(S>=_.length||C>=_.length)throw new X(o(`rangée de palier hors de la grille`));if(S<4||C<4)throw new X(o(`rangée de palier sous la 4e : moins de 4 rangées libres au-dessus`));let w=[],T=(r.repeter??[]).map(e=>{let t=/^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(e);if(!t)throw new X(o(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${e} »)`));let n={param:t[1],axis:t[2],from:Number(t[3]),to:Number(t[4])},r=n.axis===`colonnes`?x:_.length;if(n.from>n.to||n.to>=r)throw new X(o(`plage ${n.from}-${n.to} hors du gabarit`));return w.includes(n.param)||w.push(n.param),n});for(let e of T)for(let t of T)if(e!==t&&e.axis===t.axis&&e.from<=t.to&&t.from<=e.to)throw new X(o(`les plages ${e.from}-${e.to} et ${t.from}-${t.to} se chevauchent`));for(let e of y)for(let t of e.matchAll(/\{([a-z][a-z0-9]*)\}/g))w.includes(t[1])||w.push(t[1]);let E=e=>{throw new X(o(e))},D=y.filter(e=>e.startsWith(`zone `)).map(e=>yt(e.split(/\s+/),x,_.length,E));for(let e of h)D.some(t=>t.name===e)||E(`mutateur « ${e} » sans zone`);for(let e of D)h.includes(e.name)||E(`zone ${e.name} : mutateur absent de « mutateurs: »`);for(let e of[S,C])if(T.some(t=>t.axis===`rangees`&&e>=t.from&&e<=t.to))throw new X(o(`une rangée de palier ne se répète pas`));let O=[],k=(r.variante??[]).map((e,t)=>{let n={},r=[];O.push(r);for(let i of e.split(/\s+/).filter(Boolean)){if(i.startsWith(`+`)){let e=/^\+([a-z-]+)(?::(-?[a-z0-9:]+))?$/.exec(i);(!e||!h.includes(e[1]))&&E(`variante ${t} : mutateur « ${i} » non accepté (${h.join(`, `)||`aucun`})`);let n=e[1],a=e[2]??``;(n===`plafond`?a===``||a===`nu`||a===`pics`:n===`denivele`?/^-?[1-9]\d?$/.test(a):n===`patrouille`?a===``||/^[1-9]\d{0,4}$/.test(a):n===`surface`?St.includes(a):a===``)||E(`variante ${t} : argument « ${a} » de ${n} invalide`),r.some(e=>e.name===n)&&E(`variante ${t} : ${n} deux fois`),r.push({name:n,arg:a});continue}let e=/^([a-z][a-z0-9]*)=(\d+)$/.exec(i);if(!e)throw new X(o(`variante ${t} : « nom=valeur » attendu (« ${i} »)`));if(!w.includes(e[1]))throw new X(o(`variante ${t} : paramètre « ${e[1]} » inconnu`));let a=Number(e[2]),s=T.some(t=>t.param===e[1])?40:v;if(a>s)throw new X(o(`variante ${t} : ${e[1]} = ${a} (au plus ${s})`));n[e[1]]=a}for(let e of w)if(n[e]===void 0)throw new X(o(`variante ${t} : « ${e} » manque`));return r.length>2&&E(`variante ${t} : au plus 2 mutateurs`),n});if(k.length===0)throw new X(o(`au moins une « variante: » (même sans paramètre)`));return k.length>6&&E(`${k.length} variantes (au plus 6)`),new Set(k.map((e,t)=>JSON.stringify([e,O[t]]))).size!==k.length&&E(`deux variantes identiques`),{id:a,intention:s,tags:c,family:l,theme:d,long:p,elan:m,mutators:h,zones:D,mutations:O,entryRow:S,exitRow:C,repeats:T,params:w,variants:k,grid:_,annex:b,text:e}}var St=[`glace`,`tapis:gauche`,`tapis:droite`],Ct={glace:`~`,"tapis:gauche":`[`,"tapis:droite":`]`};function wt(e,t){let n=(e.mutations[t]??[]).find(e=>e.name===`surface`),r=n?n.arg===`glace`?`glace`:`usine`:null;return e.theme??r}function Tt(e,t){let n=e.grid.map(e=>e.split(``)),r=[...e.annex],i=null,a=t=>{throw new X(`Morceau « ${e.id} » : ${t}`)},o=(e,t)=>n[t][e],s=(e,t,r)=>{n[t][e]=r},c=0;for(let l of t){let t=e.zones.filter(e=>e.name===l.name);for(let e of t){let t=`${l.name} (colonnes ${e.c0}-${e.c1})`;switch(l.name){case`plafond`:for(let n=e.c0;n<=e.c1;n++)for(let r=0;r<=e.r0;r++)o(n,r)!==`.`&&o(n,r)!==`#`&&a(`${t} : tuile (${n}, ${r}) « ${o(n,r)} » sous le plafond`),s(n,r,r===e.r0&&l.arg===`pics`?`v`:`#`);break;case`fosse`:{let r=[];for(let t=e.c0;t<=e.c1;t++)r.push(o(t,e.r0)===`^`);if(r.every(Boolean))for(let t=e.c0;t<=e.c1;t++)for(let r=e.r0;r<n.length;r++)s(t,r,`.`);else for(let r=e.c0;r<=e.c1;r++){for(let i=e.r0;i<n.length;i++)o(r,i)!==`.`&&a(`${t} : ni fond de pics ni fond vide (tuile (${r}, ${i}))`);s(r,e.r0,`^`);for(let t=e.r0+1;t<n.length;t++)s(r,t,`#`)}break}case`sol-friable`:case`ressort`:case`surface`:for(let n=e.c0;n<=e.c1;n++)o(n,e.r0)!==`#`&&a(`${t} : tuile (${n}, ${e.r0}) « ${o(n,e.r0)} » au lieu d'un bloc`),s(n,e.r0,l.name===`ressort`?`*`:l.name===`surface`?Ct[l.arg]:`x`);break;case`garde`:for(let n=e.c0;n<=e.c1;n++)for(let r=e.r0;r<=e.r1;r++)o(n,r)!==`.`&&a(`${t} : tuile (${n}, ${r}) occupée`),s(n,r,e.extra);break;case`patrouille`:{let t=e.extra.split(` `);l.arg&&(t[1]=l.arg),r.push(`scie mutee${c++||``} ${t.join(` `)}`);break}case`denivele`:i={from:e.c0,k:Number(l.arg)};for(let n of r)for(let r of n.split(/\s+/).slice(5))Number(/^(\d+)/.exec(r)?.[1]??-1)>=e.c0&&a(`${t} : une scie y passe`)}}}return{grid:n.map(e=>e.join(``)),annex:r,denivele:i}}function Et(e){return e.map(e=>`+${e.name}${e.arg?`:${e.arg}`:``}`).join(` `)}function Dt(e,t,n){let r=[],i=Array(e).fill(-1),a=Array(e).fill(-1);for(let o=0;o<e;){let e=t.find(e=>e.from===o),s=e?e.to:o,c=e?n[e.param]:1;for(let e=0;e<c;e++)for(let t=o;t<=s;t++)e===0&&(i[t]=r.length),a[t]=r.length,r.push(t);o=s+1}return{src:r,first:i,last:a}}function Ot(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t.toString(16).padStart(8,`0`)}var kt=(e,t)=>e<t?`.`:`#`;function At(e,t,n={}){let r=e.variants[t];if(!r)throw new X(`Morceau « ${e.id} » : pas de variante ${t} (0 à ${e.variants.length-1})`);let i=n.lancement??0;if(!Number.isInteger(i)||i<0||i>40)throw new X(`lancement : de 0 à 40 colonnes`);let a=n=>`Morceau « ${e.id} », variante ${t} : ${n}`,o=e.mutations[t]??[],s;try{s=Tt(e,o)}catch(e){throw e instanceof X?new X(a(e.message)):e}let c=Dt(s.grid[0].length,e.repeats.filter(e=>e.axis===`colonnes`),r),l=Dt(s.grid.length,e.repeats.filter(e=>e.axis===`rangees`),r),u=c.src.length;if(u<1)throw new X(a(`grille vide`));let d=l.first[e.entryRow],f=l.first[e.exitRow],p=i+1+2,m=p+u+2,h=i>0?0:1,g=l.src.map(e=>c.src.map(t=>s.grid[e][t]));if(s.denivele){let{from:e,k:t}=s.denivele,n=c.src.map(t=>t>=e);if(t>0){let e=g[g.length-1];for(let n=0;n<t;n++)g.push([...e])}else if(f+t<4)throw new X(a(`dénivelé ${t} : moins de 4 rangées au-dessus de la sortie`));let r=g.length;for(let e=0;e<n.length;e++){if(!n[e])continue;let i=g.map(t=>t[e]);for(let n=0;n<r;n++)g[n][e]=t>0?n>=t?i[n-t]:`.`:n-t<r?i[n-t]:i[r-1]}f+=t}let _=g.map(e=>e.join(``)),v=_.length;if(v>30)throw new X(a(`${v} rangées (au plus 30)`));let y=_.map((e,t)=>{let n=kt(t,d).repeat(p),r=t===d-1?n.slice(0,h)+`S`+n.slice(h+1):n,i=kt(t,f).repeat(3)+(t===f-1?`F`:kt(t,f));return r+e+i}),b=[`section ${e.id} ${p}-${p+u-1}`];for(let e of s.annex){let t=e.replace(/\{([a-z][a-z0-9]*)\}/g,(e,t)=>String(r[t])).split(/\s+/);if(t[0]!==`scie`)throw new X(a(`bloc annexe : seules les scies sont permises (« ${t[0]} »)`));b.push(t.map((e,t)=>{let n=t>=5?/^(\d+)('?),(\d+)('?)$/.exec(e):null;if(!n)return e;let r=Number(n[1]),i=Number(n[3]),o=(n[2]?c.last:c.first)[r],s=(n[4]?l.last:l.first)[i];if(o===void 0||s===void 0||o<0||s<0)throw new X(a(`point ${e} hors de la grille ou retiré par la variante`));return`${o+p},${s}`}).join(` `))}let x=y.join(`
`)+`

`+b.join(`
`)+`
`,C;try{C=O(x)}catch(e){throw e instanceof S?new X(a(e.message)):e}let w={id:e.id,variant:t,values:r,mutations:o,levelId:`module:${e.id}:${t}`,level:C,ascii:x,hash:Ot(x),lead:p,width:u,height:v,entryRow:d,exitRow:f,palierIn:{col0:p-2,col1:p-1,row:d},palierOut:{col0:p+u,col1:p+u+2-1,row:f},exitCol:m},T=jt(w);if(T.length>0)throw new X(a(T.join(` ; `)));return w}function jt(e){let t=[],n=e.level,r=p,i=(e,t)=>n.tiles[t*n.width+e];for(let[a,o]of[[`entrée`,e.palierIn],[`sortie`,e.palierOut]]){o.row<4&&t.push(`palier d'${a} : moins de 4 rangées au-dessus`);for(let e=o.col0;e<=o.col1;e++)for(let r=0;r<n.height;r++){let n=r<o.row?0:1;i(e,r)!==n&&t.push(`palier d'${a} : tuile (${e}, ${r}) ${n===1?`vide`:`occupée`}`)}let e={x:o.col0*r,y:(o.row-4)*r,w:(o.col1-o.col0+1)*r,h:4*r};for(let r of n.saws){let n=r.cycle===0?1:r.cycle;for(let i=0;i<n;i++){let n=j(r,i);if(ve(n.x,n.y,r.radius,e)){t.push(`palier d'${a} : la scie ${r.id} y passe`);break}}}}return h(i(e.lead,e.entryRow-1))&&t.push(`première colonne du morceau pleine au ras du sol : on n'y entre pas en courant`),t}var Mt=dt.map(xt);function Nt(e){let t=Mt.find(t=>t.id===e);if(!t)throw new X(`Morceau « ${e} » inconnu`);return t}function Pt(e,t,n={}){return At(Nt(e),t,n)}Array.from({length:25},(e,t)=>7+15*t);function Ft(e){return N(e.x+m(F,2))}function It(e){return e.ground===1&&e.vx===L.runSpeed&&e.vy===0&&e.air===0&&e.wallSide===0&&e.wallAir===255&&e.slide===0&&e.buffer===0&&e.held===0&&e.jumping===0&&e.lock===0&&e.lockDir===0}function Lt(e,t){return ft.jumpSimVersion===3?ft.modules[e]?.variants[t]??null:null}function Rt(e){return!e||!e.arret||!e.elan||e.arret.exigence===0||e.elan.exigence===0?0:Math.max(e.arret.exigence,e.elan.exigence)}var zt=n(2026,10,16);function Bt(e){return e-zt+1}function Vt(e,t=null){let n=ut(e);return`jour-${a(e)}-g6${t!==null&&t!==n?`-t${t}`:``}`}var Ht=3e3,Ut=4800,Wt=3600,Gt=3360,Kt=3840,qt=240,Jt=360,Yt=1785689458,Xt={gold:110,silver:130,bronze:160},Zt=`repos2527:`;function Qt(e){let t=$t[e];return t===void 0?Number.parseInt(Ot(`${Zt}${e}`),16)%7:t}var $t={"glace-cheminee":4,"glace-corniches":3,"glace-freinage":0,"glace-mur":6,"glace-promenade":5,"glace-relais":2,"glace-saut-haut":1,"tapis-alternes":4,"tapis-contraire":6,"tapis-escalier":1,"tapis-lance":3,"tapis-mur":0,"tapis-relais":2,"tapis-respiration":5};function en(e,t){return((e-(4*t%7+7)%7)%7+7)%7<4}function tn(e,t){return!en(Qt(e),t)}var nn=(e,t)=>m(e*t+99,100);function rn(e){return{author:e,gold:nn(e,Xt.gold),silver:nn(e,Xt.silver),bronze:nn(e,Xt.bronze)}}function an(e,t){return e<=t.author?`author`:e<=t.gold?`gold`:e<=t.silver?`silver`:e<=t.bronze?`bronze`:null}var on=null;function sn(){return on||(on=Mt.map(e=>e.variants.flatMap((t,n)=>{let r=Lt(e.id,n),i=Rt(r);if(!r?.arret||!r.elan||i<1)return[];let a=Pt(e.id,n),o=e=>e.exitTick-e.entryTick,s=wt(e,n);return[{id:e.id,variant:n,tags:e.tags,theme:s,mechanic:s===null?null:ot(s),family:e.family,long:e.long,exigence:i,arret:o(r.arret),elan:o(r.elan),height:a.height,width:a.width,entryRow:a.entryRow,exitRow:a.exitRow}]})).filter(e=>e.length>0),on)}var Z=(e,t)=>e.tags.includes(t),Q=e=>e.entry===`arret`?e.choice.arret:e.choice.elan;function cn(e){let t=[],n=0;e.forEach((r,i)=>{i>0&&(n=t[i-1]+e[i-1].choice.exitRow-r.choice.entryRow),t.push(n)});let r=0,i=0;return e.forEach((e,n)=>{(n===0||t[n]<r)&&(r=t[n]),(n===0||t[n]+e.choice.height>i)&&(i=t[n]+e.choice.height)}),{tops:t.map(e=>e-r+1),height:i-r+1}}var $=(e,t)=>m(e*1e3,t);function ln(e,t,n){let r=ot(n),i=sn().map(e=>e.filter(e=>e.theme===null||e.theme===n)).filter(t=>t.length>0&&!tn(t[0].id,e)),a=[],o=new Set,s=new Set,c=0;for(;;){if(a.length>=13)return`trop de morceaux`;let e=a.length===0?`arret`:`elan`,n=$(c,Wt),l=a.reduce((e,t)=>e+t.choice.exigence,0)*100,u=n<600?0:m((m(505*c,720)-l)*100,100),d=100+m(260*(n<1e3?n:1e3),1e3)+u,f=a.length>=2&&a.slice(-2).every(e=>Z(e.choice,`precision`)),p=!a.some(e=>Z(e.choice,`mural`)),h=!a.some(e=>Z(e.choice,`scie`)),g=!a.some(e=>Z(e.choice,`respiration`)),_=!a.some(e=>e.choice.exigence>=4),v=a.filter(e=>e.choice.long).length,y=v<1&&n>=300,b=(e,t)=>{let n=c+m(t,2);return n>=m(Kt*350,1e3)&&n<=m(Gt*650,1e3)&&Z(e,`respiration`)},x=g&&c+Jt>m(Gt*650,1e3),S=p&&n>=550,C=h&&n>=550,w=_&&n>=667,T=a.filter(e=>e.choice.mechanic!==null),E=T.reduce((e,t)=>e+Q(t),0),D=r!==null&&T.length<2&&n>=450,O=(e,t)=>{let n=e.filter(e=>e.choice.mechanic!==null),r=n.reduce((e,t)=>e+Q(t),0);return n.length>=2&&r*1e3>=200*t&&r*1e3<=400*t},k=[];for(let n of i){let i=n[0].id;if(o.has(i)||s.has(n[0].family))continue;let l=n[0].tags;if((n[0].long?v>=2:y&&!x)||f&&l.includes(`precision`)||l.includes(`respiration`)&&!g||x&&!l.includes(`respiration`)||(S||C||D)&&!(S&&l.includes(`mural`)||C&&l.includes(`scie`)||D&&n.some(e=>e.mechanic!==null)))continue;let u=n.filter(t=>{let n={choice:t,entry:e},i=Q(n)+0;if(Z(t,`respiration`)&&!b(t,i)||w&&t.exigence<4||D&&t.mechanic===null&&!(S&&l.includes(`mural`)||C&&l.includes(`scie`)))return!1;let o=c+i;if(t.mechanic!==null&&(E+i)*1e3>400*Kt||o>Kt)return!1;if(o>=Gt){let e=[...a.map(e=>e.choice),t];if(!e.some(e=>Z(e,`mural`))||!e.some(e=>Z(e,`scie`))||!e.some(e=>Z(e,`respiration`))||!e.some(e=>e.exigence>=4)||e.length<6||e.filter(e=>e.long).length<1||r!==null&&!O([...a,n],o))return!1}return cn([...a,n]).height<=56});if(u.length===0)continue;let m=[],_=1/0;for(let e of u){let t=Math.abs(e.exigence*100-d);t<_?(_=t,m=[e]):t===_&&m.push(e)}let T=m.length===1?m[0]:t.pick(m),A=_<=50?8:_<=100?5:_<=200?2:1;(p&&Z(T,`mural`)||h&&Z(T,`scie`))&&(A*=2),Z(T,`respiration`)&&(A*=4),T.mechanic!==null&&E*1e3<300*(c+Q({choice:T,entry:e}))&&(A*=3),k.push({pick:{choice:T,entry:e},weight:A})}if(k.length===0){let e=[x&&`respiration`,y&&!x&&`long`,S&&`mural`,C&&`scie`,w&&`pointe`].filter(Boolean);return`impasse au morceau ${a.length+1}${e.length?` (imposés : ${e.join(`, `)})`:``}`}let A=0;for(let e of k)A+=e.weight;let j=t.int(A),M=k[0];for(let e of k){if(j<e.weight){M=e;break}j-=e.weight}if(a.push(M.pick),o.add(M.pick.choice.id),s.add(M.pick.choice.family),c+=Q(M.pick)+(a.length,0),c>=Gt)return a}}function un(e){let t=sn().flat(),n=e.map((e,n)=>{let r=t.find(t=>t.id===e.id&&t.variant===e.variant);if(!r)throw RangeError(`Morceau « ${e.id} », variante ${e.variant} : pas de solution utilisable`);return{choice:r,entry:n===0?`arret`:`elan`}});if(n.length===0)throw RangeError(`Assemblage vide`);let{tops:r,height:i}=cn(n),a=1+n.reduce((e,t)=>e+t.choice.width,0)+(n.length+1)*2+1,o=[];for(let e=0;e<i;e++)o.push(Array(a).fill(`#`));let s=[],c=[],l=[],u=3;n.forEach((e,t)=>{let n=Pt(e.choice.id,e.choice.variant),[a,l=``]=n.ascii.split(`

`),d=a.split(`
`).map(e=>e.slice(n.lead,n.lead+n.width)),f=r[t];for(let e=0;e<d.length;e++)for(let t=0;t<n.width;t++)o[f+e][u+t]=d[e][t];let p=d[d.length-1];for(let e=0;e<n.width;e++)if(p[e]!==`#`)for(let t=f+d.length;t<i;t++)o[t][u+e]=`.`;s.push(`section ${e.choice.id} ${u}-${u+n.width-1}`);for(let t of l.split(`
`)){let r=t.trim().split(/\s+/);r[0]===`scie`&&s.push(r.map((t,r)=>{if(r===1)return`${e.choice.id}/${t}`;let i=r>=5?/^(\d+),(\d+)$/.exec(t):null;return i?`${Number(i[1])-n.lead+u},${Number(i[2])+f}`:t}).join(` `))}c.push({id:e.choice.id,variant:e.choice.variant,entry:e.entry,tags:e.choice.tags,family:e.choice.family,long:e.choice.long,mechanic:e.choice.mechanic,exigence:e.choice.exigence,solutionTicks:Q(e),col0:u,col1:u+n.width-1,top:f,entryRow:f+n.entryRow,exitRow:f+n.exitRow,start:0,end:0}),u+=n.width+2});for(let e=0;e<=n.length;e++){let t=c[e-1],r=c[e],a=r?r.entryRow:t.exitRow,s=Math.min(t?t.top:i,r?r.top:i),u=r?r.col0-2:t.col1+1,d=e===0?u-1:u,f=e===n.length?u+2+1:u+2;for(let e=d;e<f;e++)for(let t=s;t<a;t++)o[t][e]=`.`;l.push({col0:u,col1:u+2-1,row:a}),o[a-1][u]=e===0?`S`:e===n.length?`.`:`C`,e===n.length&&(o[a-1][u+2]=`F`)}let d=o.map(e=>e.join(``)).join(`
`)+`

`+s.join(`
`)+`
`;return{level:O(d),ascii:d,pieces:c,paliers:l}}function dn(e){let t=e.level,n=(e,n)=>q(e,n,t,L),r=[],i=[],a=K(t);for(let t=0;t<e.pieces.length;t++){let o=e.pieces[t],s=Lt(o.id,o.variant)?.[o.entry];if(!s)return`${o.id}:${o.variant} sans solution`;let c=ze(He(s.code).runs),l=t===e.pieces.length-1,u=l?-1:e.pieces[t+1].col0;i.push(r.length);let d=!1,f=c.length+64;for(let e=t===0?0:s.entryTick;e<f&&!d;e++){let i=e<c.length?c[e]:2;if(a=n(a,i),r.push(i),a.status===2)return`${o.id}:${o.variant} meurt (morceau ${t+1})`;if(a.status===3){if(!l)return`${o.id}:${o.variant} touche l'arrivée (morceau ${t+1})`;d=!0}else if(!l&&Ft(a.player)>=u){if(!It(a.player))return`${o.id}:${o.variant} sort hors de la course propre (morceau ${t+1})`;d=!0}}if(!d)return`${o.id}:${o.variant} n'aboutit pas (morceau ${t+1})`}return{inputs:r,starts:i}}function fn(e,t){let n=0,r=[[0,0],[0,0],[0,0]];for(let i of e){n+=i.exigence;let e=m(i.start+i.end,2),a=e*3<t?0:e*3<t*2?1:2;r[a][0]+=i.exigence*(i.end-i.start),r[a][1]+=i.end-i.start}let i=e=>e[1]===0?0:m(e[0]*10,e[1]);return{sum:n,rate:t>0?m(n*10*60*120,t):0,thirds:[i(r[0]),i(r[1]),i(r[2])]}}function pn(e){let t=[],{pieces:n,authorTicks:r}=e;(r<Ht||r>Ut)&&t.push(`temps de l'auteur ${r} pas hors de [${Ht}, ${Ut}]`),(n.length<6||n.length>13)&&t.push(`${n.length} morceaux (de 6 à 13)`),e.level.height>56&&t.push(`hauteur ${e.level.height} (au plus 56)`),new Set(n.map(e=>e.id)).size!==n.length&&t.push(`morceau en double`),new Set(n.map(e=>e.family)).size!==n.length&&t.push(`famille en double`);let i=n.filter(e=>e.long).length;(i<1||i>2)&&t.push(`${i} enchaînements longs (de 1 à 2)`),e.longestRun>qt&&t.push(`course au sol sans saut de ${e.longestRun} pas (au plus ${qt})`),n.some(e=>e.tags.includes(`mural`))||t.push(`aucun morceau mural`),n.some(e=>e.tags.includes(`scie`))||t.push(`aucun morceau scie`);let a=0;for(let e of n)a=e.tags.includes(`precision`)?a+1:0,a>2&&t.push(`plus de 2 morceaux precision d'affilée`);let o=n.filter(e=>e.tags.includes(`respiration`));o.length!==1&&t.push(`${o.length} morceaux respiration (un seul, au milieu)`);for(let e of o){let n=$(e.start+e.end,2*r);(n<350||n>650)&&t.push(`respiration à ${n} ‰ (entre 350 et 650)`)}(n[0]?.entry!==`arret`||n.slice(1).some(e=>e.entry!==`elan`))&&t.push(`entrées : le premier à l'arrêt, les autres en élan`),n.some(e=>e.exigence>=4)||t.push(`aucun morceau d'exigence 4 ou plus`);let s=e.exigence;if((s.rate<445||s.rate>570)&&t.push(`exigence ${s.rate} hors de [445, 570]`),s.thirds[2]<s.thirds[0]&&t.push(`le dernier tiers (${s.thirds[2]}) est moins exigeant que le premier (${s.thirds[0]})`),s.thirds[2]<s.thirds[1]&&t.push(`le dernier tiers (${s.thirds[2]}) est moins exigeant que le deuxième (${s.thirds[1]})`),e.theme!==void 0&&ot(e.theme)!==null){let i=n.filter(e=>e.mechanic!==null),a=i.reduce((e,t)=>e+(t.end-t.start),0);i.length<2&&t.push(`${i.length} morceaux de la mécanique ${ot(e.theme)} (au moins 2)`),i.some(e=>e.end-e.start<st)&&t.push(`un morceau de la mécanique dure moins d'une seconde`),(a*1e3<200*r||a*1e3>400*r)&&t.push(`la mécanique prend ${$(a,r)} ‰ du temps (de 200 à 400)`)}else e.theme!==void 0&&n.some(e=>e.mechanic!==null)&&t.push(`un morceau de mécanique hors de son thème`);let c=e.palierTicks.reduce((e,t)=>e+t,0);return c*1e3>=60*r&&t.push(`course à vide sur les paliers ${$(c,r)} ‰ (moins de 60 ‰)`),t}function mn(e,t,n){let r=t.slice(1,-1),i=r.map(()=>0),a=K(e);for(let t of n){if(a=q(a,t,e,L),a.status===2)break;if(a.player.ground===1&&!(t&4)){let e=Ft(a.player);for(let t=0;t<r.length;t++)e>=r[t].col0&&e<=r[t].col1&&i[t]++}if(a.status===3)break}return i}function hn(e,t){let n=K(e),r=0,i=0;for(let a of t)if(n=q(n,a,e,L),n.status===2||(r=n.player.ground===1&&!(a&4)?r+1:0,r>i&&(i=r),n.status===3))break;return i}function gn(e,t){return $(Math.abs(e-Wt),Wt)+$(Math.abs(t-505),505)}function _n(e,t,n){let r;try{r=un(e)}catch(e){return`assemblage : ${e.message}`}let i=dn(r);if(typeof i==`string`)return i;let a={simVersion:3,levelId:t,start:{checkpoint:-1,held:0,time:0,sections:[],elan:0},runs:Re(i.inputs)},o=qe(r.level,a,t);if(!o.finished)return`le rejeu n'arrive pas`;if(o.deaths.length>0)return`le rejeu meurt ${o.deaths.length} fois`;let s=o.time,c=r.pieces.map((e,t)=>({...e,start:i.starts[t],end:t+1<r.pieces.length?i.starts[t+1]:s})),l={id:t,level:r.level,ascii:r.ascii,hash:Ot(r.ascii),pieces:c,paliers:r.paliers,palierTicks:mn(r.level,r.paliers,i.inputs),longestRun:hn(r.level,i.inputs),replay:a,code:Ve(a),authorTicks:s,medals:rn(s),exigence:fn(c,s)};return{built:l,problems:pn({...l,theme:n})}}var vn=[{id:`mur-seul`,variant:4},{id:`ressorts-escalier`,variant:0},{id:`plongeon`,variant:0},{id:`tunnel-scies`,variant:1},{id:`iles-scie`,variant:2},{id:`escalier`,variant:1},{id:`piliers`,variant:1},{id:`puits-descente`,variant:2},{id:`mur-friable`,variant:2},{id:`marelle`,variant:2}],yn={usine:[{id:`cheminee-pics`,variant:2},{id:`tapis-contraire`,variant:3},{id:`demi-tour`,variant:5},{id:`tapis-mur`,variant:1},{id:`puits-descente`,variant:1},{id:`tapis-respiration`,variant:0},{id:`toboggan`,variant:1},{id:`tremplin`,variant:0},{id:`escalier-scies`,variant:3},{id:`lucarne`,variant:1}],glace:[{id:`ressort-scie`,variant:1},{id:`cheminee-vide`,variant:0},{id:`glace-relais`,variant:2},{id:`plongeon`,variant:0},{id:`rebonds-doux`,variant:1},{id:`mur-seul`,variant:0},{id:`glace-cheminee`,variant:2},{id:`plafond-pics`,variant:2},{id:`marelle`,variant:3},{id:`mur-friable`,variant:1},{id:`puits-descente`,variant:1}]};function bn(e){return yn[e]??vn}var xn=new Map;function Sn(n,r=null){let i=ut(n),o=r??i,s=o!==i,c=`${n}:${o}`,l=xn.get(c);if(l)return l;let u=Vt(n,o),d=t(n,Yt),f=[],p=null;for(let r=0;r<40&&!(r>=6&&p);r++){let i=ln(n,new e(t(d,r)),o);if(typeof i==`string`){f.push({index:r,status:`impasse`,reason:i,pieces:[],ticks:0,rate:0,score:0});continue}let a=i.map(e=>`${e.choice.id}:${e.choice.variant}`),s=_n(i.map(e=>({id:e.choice.id,variant:e.choice.variant})),u,o);if(typeof s==`string`){f.push({index:r,status:`refusé`,reason:s,pieces:a,ticks:0,rate:0,score:0});continue}let{built:c,problems:l}=s,m=gn(c.authorTicks,c.exigence.rate),h=l.length>0?`refusé`:`valide`;f.push({index:r,status:h,reason:l.join(` ; `),pieces:a,ticks:c.authorTicks,rate:c.exigence.rate,score:m}),!(l.length>0)&&(!p||m<p.score)&&(p={built:c,index:r,score:m})}let m;if(p)m={...p.built,theme:o,forcedTheme:s,day:n,date:a(n),number:Bt(n),attempts:f,chosen:p.index,fallback:!1};else{let e=_n(bn(o),u,o);if(typeof e==`string`||e.problems.length>0)throw Error(`Niveau de secours invalide : ${typeof e==`string`?e:e.problems.join(` ; `)}`);m={...e.built,theme:o,forcedTheme:s,day:n,date:a(n),number:Bt(n),attempts:f,chosen:-1,fallback:!0}}return xn.set(c,m),m}export{A as $,ke as A,ne as B,Ve as C,Qe as D,qe as E,xe as F,V as G,F as H,me as I,ie as J,re as K,q as L,De as M,fe as N,Ue as O,K as P,N as Q,L as R,He as S,Je as T,R as U,I as V,B as W,ae as X,se as Y,H as Z,ut as _,rn as a,n as at,Y as b,ht as c,e as ct,Lt as d,h as et,Et as f,rt as g,wt as h,an as i,r as it,Oe as j,Le as k,pt as l,Rt as m,Sn as n,O as nt,Bt as o,a as ot,Ot as p,ce as q,Vt as r,p as rt,Mt as s,o as st,zt as t,g as tt,Pt as u,nt as v,ze as w,Ye as x,Xe as y,z};