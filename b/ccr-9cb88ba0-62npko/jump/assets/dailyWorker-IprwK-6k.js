(function(){var e=class{state;constructor(e){this.state=e>>>0}next(){this.state=this.state+1831565813>>>0;let e=this.state;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}int(e){return this.next()%e}chance(e){return this.int(100)<e}pick(e){return e[this.int(e.length)]}shuffle(e){let t=e.slice();for(let e=t.length-1;e>0;e--){let n=this.int(e+1);[t[e],t[n]]=[t[n],t[e]]}return t}};function t(e,t){let n=Math.imul((e|0)^2654435769,2246822507);return n^=n>>>13,n=Math.imul(n^(t|0),3266489909),n^=n>>>16,n>>>0}function n(e,t,n){let r=t<=2?e-1:e,i=Math.floor(r/400),a=r-i*400,o=Math.floor((153*(t+(t>2?-3:9))+2)/5)+n-1,s=a*365+Math.floor(a/4)-Math.floor(a/100)+o;return i*146097+s-719468}function r(e){let t=e+719468,n=Math.floor(t/146097),r=t-n*146097,i=Math.floor((r-Math.floor(r/1460)+Math.floor(r/36524)-Math.floor(r/146096))/365),a=r-(365*i+Math.floor(i/4)-Math.floor(i/100)),o=Math.floor((5*a+2)/153),s=a-Math.floor((153*o+2)/5)+1,c=o+(o<10?3:-9);return{y:i+n*400+ +(c<=2),m:c,d:s}}let i=(e,t)=>{let n=String(e);for(;n.length<t;)n=`0`+n;return n};function a(e){let{y:t,m:n,d:a}=r(e);return`${i(t,4)}-${i(n,2)}-${i(a,2)}`}var o=class extends Error{constructor(e){super(e),this.name=`CodecError`}};let s=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`;function c(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2];t+=s[r>>2],t+=s[(r&3)<<4|(i??0)>>4],i!==void 0&&(t+=s[(i&15)<<2|(a??0)>>6]),a!==void 0&&(t+=s[a&63])}return t}function l(e){let t=[],n=0,r=0;for(let i=0;i<e.length;i++){let a=s.indexOf(e[i]);if(a<0)throw new o(`caractère invalide`);n=n<<6|a,r+=6,r>=8&&(r-=8,t.push(n>>r&255),n&=(1<<r)-1)}if(r>=6)throw new o(`longueur invalide`);return t}function u(e,t){for(;t>=128;)e.push(t&127|128),t>>=7;e.push(t)}function d(e,t=21){let n=0,r=0;for(;;){let i=e();if(n+=(i&127)*(1<<r),!(i&128))return n;if(r+=7,r>t)throw new o(`entier trop long`)}}let f=4096;function p(e,t){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t))throw RangeError(`idiv attend des entiers sûrs (${e}, ${t})`);if(t===0)throw RangeError(`idiv : division par zéro`);return(e-e%t)/t+0}function m(e){return e>=1&&e<=3}function h(e){return e>=4&&e<=7}let g=72e3,_=1792,v=5632;var y=class extends Error{constructor(e){super(e),this.name=`LevelError`}};let b={"#":1,".":0,S:0,F:0,C:0,o:0,O:0,x:2,"*":3,"^":4,v:5,"<":6,">":7},x=p(f,2),S=(e,t)=>({x:e*f+x,y:t*f+x});function C(e,t){let n=/^(\d+)(?:\.(\d{1,6}))?$/.exec(e);if(!n)throw new y(`${t} : « ${e} » n'est pas un nombre de tuiles`);let r=n[2]??``,i=1;for(let e=0;e<r.length;e++)i*=10;return p((Number(n[1])*i+(r?Number(r):0))*f*2+i,i*2)}function w(e,t,n){let r=t===`aller-retour`?[...e,...e.slice(1,-1).reverse()]:[...e],i=[],a=0;for(let e=0;e<r.length;e++){let t=r[e],n=r[(e+1)%r.length],o=(t.x>n.x?t.x-n.x:n.x-t.x)+(t.y>n.y?t.y-n.y:n.y-t.y);i.push(o),a+=o}let o=[0],s=0;for(let e=0;e<r.length;e++)s+=i[e],o.push(a===0?n:p(n*s,a));return{nodes:r,times:o}}function T(e){let t=e.replace(/\r/g,``).split(`
`);for(;t.length>0&&t[0].trim()===``;)t.shift();for(;t.length>0&&t[t.length-1].trim()===``;)t.pop();if(t.length===0)throw new y(`Niveau vide`);let n=t.findIndex(e=>e.trim()===``);n<0&&(n=t.length);let r=t.slice(0,n),i=t.slice(n),a=r[0].length,o=r.length;if(a>2048||o>512)throw new y(`Niveau trop grand (${a} × ${o}, au plus 2048 × 512)`);let s=[],c=[],l=[],u=[],d=[],f=[],p=[];for(let e=0;e<o;e++){let t=r[e];if(t.length!==a)throw new y(`Ligne ${e+1} : ${t.length} colonnes au lieu de ${a}`);for(let n=0;n<a;n++){let r=t[n],i=b[r];if(i===void 0)throw new y(`Ligne ${e+1}, colonne ${n+1} : caractère « ${r} » inconnu`);if(s.push(i),f.push(i===2?d.length:-1),i===2&&d.push({col:n,row:e}),r===`S`&&c.push({col:n,row:e}),r===`F`&&l.push({col:n,row:e}),r===`C`&&p.push({col:n,row:e}),r===`o`||r===`O`){let t=S(n,e);u.push({id:`${r}${u.length}`,radius:r===`o`?_:v,mode:`fixe`,points:[t],cycle:0,section:-1,nodes:[t],times:[0,0]})}}}p.sort((e,t)=>e.col-t.col||e.row-t.row);for(let e=1;e<p.length;e++)if(p[e].col===p[e-1].col)throw new y(`Deux points de passage « C » dans la colonne ${p[e].col+1} (un seul par colonne)`);if(c.length!==1)throw new y(`Il faut exactement un départ « S » (${c.length} trouvés)`);if(l.length!==1)throw new y(`Il faut exactement une arrivée « F » (${l.length} trouvées)`);let m=[],h=[];for(let e=0;e<i.length;e++){let t=i[e].trim();if(t===``||t.startsWith(`//`))continue;let r=t.split(/\s+/),o=`Annexe, ligne ${n+e+1}`;if(r[0]===`section`){let e=r.length===3?/^(\d+)-(\d+)$/.exec(r[2]):null;if(!e)throw new y(`${o} : « section <nom> <col0>-<col1> » attendu`);let t=Number(e[1]),n=Number(e[2]);if(t>n||n>=a)throw new y(`${o} : colonnes ${t}-${n} hors de la grille (0-${a-1})`);if(m.some(e=>e.name===r[1]))throw new y(`${o} : section « ${r[1]} » déjà déclarée`);let i=m.find(e=>t<=e.c1&&e.c0<=n);if(i)throw new y(`${o} : chevauche la section « ${i.name} »`);m.push({name:r[1],c0:t,c1:n})}else if(r[0]===`scie`)h.push({line:n+e+1,words:r});else throw new y(`${o} : déclaration « ${r[0]} » inconnue (section, scie)`)}for(let{line:e,words:t}of h){let n=`Annexe, ligne ${e}`;if(t.length<7)throw new y(`${n} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);let[,r,i,s,c]=t;if(u.some(e=>e.id===r))throw new y(`${n} : scie « ${r} » déjà déclarée`);let l=i===`o`?_:i===`O`?v:C(i,n);if(l<=0||l>16384)throw new y(`${n} : rayon hors bornes (au plus 4 tuiles)`);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>72e3)throw new y(`${n} : cycle en pas attendu (1 à ${g})`);if(c!==`aller-retour`&&c!==`boucle`)throw new y(`${n} : mode « ${c} » inconnu (aller-retour, boucle)`);let d=t.slice(5).map(e=>{let t=/^(\d+),(\d+)$/.exec(e);if(!t)throw new y(`${n} : point « ${e} » (col,rangée) attendu`);let r={col:Number(t[1]),row:Number(t[2])};if(r.col>=a||r.row>=o)throw new y(`${n} : point ${e} hors de la grille`);return r});if(d.length>32)throw new y(`${n} : au plus 32 points`);let f=m.findIndex(e=>d[0].col>=e.c0&&d[0].col<=e.c1);if(f<0)throw new y(`${n} : le premier point (colonne ${d[0].col}) n'est dans aucune section`);let p=d.map(e=>S(e.col,e.row)),h=Number(s);u.push({id:r,radius:l,mode:c,points:p,cycle:h,section:f,...w(p,c,h)})}return{width:a,height:o,tiles:s,start:c[0],finish:l[0],sections:m,saws:u,crumbles:d,crumbleIndex:f,checkpoints:p}}function E(e,t,n){return n>=e.height?0:t<0||n<0||t>=e.width?1:e.tiles[n*e.width+t]}function D(e,t){if(e.cycle===0||t<=0)return e.nodes[0];let n=t%e.cycle,r=e.nodes.length,i=0;for(;i<r-1&&n>=e.times[i+1];)i++;let a=e.nodes[i],o=e.nodes[(i+1)%r],s=e.times[i],c=e.times[i+1]-s;return c<=0?a:{x:a.x+p((o.x-a.x)*(n-s),c),y:a.y+p((o.y-a.y)*(n-s),c)}}function O(e){return e>>12}function k(e,t,n,r,i){for(let a=r;a<=i;a++)for(let r=t;r<=n;r++)if(m(E(e,r,a)))return!0;return!1}function A(e,t,n,r,i){return k(e,O(t),O(t+r-1),O(n),O(n+i-1))}function j(e,t,n,r,i,a,o){if(r===0)return{pos:t,blocked:!1};let s=O(i),c=O(i+a-1),l=t=>o?k(e,t,t,s,c):k(e,s,c,t,t);if(r>0){let e=O(t+n-1)+1,i=O(t+n+r-1);for(let t=e;t<=i;t++)if(l(t))return{pos:t*f-n,blocked:!0}}else{let e=O(t)-1,n=O(t+r);for(let t=e;t>=n;t--)if(l(t))return{pos:(t+1)*f,blocked:!0}}return{pos:t+r,blocked:!1}}let M=3072,N=3072,P=2048,F=Object.freeze({runSpeed:375,groundAccel:17,groundDecel:32,airAccel:13,airDecel:6,gravity:19,fallSpeed:751,jumpSpeed:800,jumpCut:340,slideSpeed:171,wallJumpX:340,wallJumpY:680,wallLock:0,wallReach:512,coyote:10,wallCoyote:6,jumpBuffer:12,cornerTolerance:1024,crumbleDelay:30,springSpeed:1056});Object.keys(F),Object.freeze({sprintMode:1,sprintSpeed:512,sprintDelay:48,sprintAccel:2});function ee(e){let t=e.sprintSpeed??0;return t<e.runSpeed?e.runSpeed:t>2048?P:t}function I(e){let t=e.start.col*f+p(1024,2),n=(e.start.row+1)*f-N,r=+!!A(e,t,n+1,3072,3072);return{x:t,y:n,vx:0,vy:0,ground:r,air:r?0:255,wallSide:0,wallAir:255,slide:0,buffer:0,held:0,jumping:0,lock:0,lockDir:0}}let te=(e,t,n)=>e<t?t:e>n?n:e,L=(e,t,n)=>e<t?e+n>t?t:e+n:e-n<t?t:e-n;function R(e,t,n,r,i){let a=O(n),o=O(n+N-1),s=r<0?t:t+M,c=r<0?O(t)-1:O(t+M-1)+1,l=O(r<0?t-i-1:t+M+i);for(let t=c;r<0?t>=l:t<=l;t+=r)for(let n=a;n<=o;n++)if(m(E(e,t,n)))return r<0?s-(t+1)*f:t*f-s;return-1}function z(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=r,a=(t&2?1:0)-(t&1?1:0),o=t&4?1:0,s=o===1&&e.held===0;e.lock>0&&a===e.lockDir&&(a=0);let c=e.lock>0?e.lock-1:0,l=c>0?e.lockDir:0,u=e.ground===1,d=u?i.groundAccel:i.airAccel,p=u?i.groundDecel:i.airDecel,h=i.sprintMode===1,g=h?e.sprint??0:0,_=e.vx;if(a===0)_=L(_,0,p);else if(_*a<0)_=L(_,a*i.runSpeed,d>p?d:p);else if(h&&g>=(i.sprintDelay??0)&&_*a>=i.runSpeed&&ee(i)>i.runSpeed){let e=ee(i);_*a>e?_=L(_,a*e,p):u&&(_=L(_,a*e,i.sprintAccel??0))}else _=_*a>i.runSpeed?L(_,a*i.runSpeed,p):L(_,a*i.runSpeed,d);let v=e.vy,y=0;!u&&v>=0&&a!==0&&R(n,e.x,e.y,a,1)===0&&(y=a);let b=y===0?i.fallSpeed:i.slideSpeed;v=v<b?v+i.gravity>b?b:v+i.gravity:v-i.gravity<b?b:v-i.gravity;let x=e.air,S=e.wallAir,C=e.jumping,w=!1,T=!1;if(s||e.buffer>0){if(u||e.air<=i.coyote)v=-i.jumpSpeed,w=!0,x=255;else{let t=R(n,e.x,e.y,-1,i.wallReach),r=R(n,e.x,e.y,1,i.wallReach),o=0;t>=0&&r>=0?o=a===0?t<=r?-1:1:a:t>=0?o=-1:r>=0?o=1:e.wallSide!==0&&e.wallAir<=i.wallCoyote&&(o=e.wallSide),o!==0&&(_=-o*i.wallJumpX,v=-i.wallJumpY,w=!0,T=!0,y=0,S=255,c=i.wallLock,l=c>0?o:0)}}w&&(C=1);let D=w?0:s?i.jumpBuffer:e.buffer>0?e.buffer-1:0;C===1&&o===0&&v<-i.jumpCut&&(v=-i.jumpCut,C=0),v>=0&&(C=0),_=te(_,-2048,P),v=te(v,-2048,P);let k=e.x,F=e.y,I=j(n,k,M,_,F,N,!0);k=I.pos,I.blocked&&(_=0);let z=j(n,F,N,v,k,M,!1);if(z.blocked&&v<0&&i.cornerTolerance>0){let e=O(z.pos)-1,t=O(k),r=O(k+M-1),a=m(E(n,t,e)),o=m(E(n,r,e)),s=k;t!==r&&a&&!o&&(t+1)*4096-k<=i.cornerTolerance?s=(t+1)*f:t!==r&&o&&!a&&k+3072-r*4096<=i.cornerTolerance&&(s=r*f-M),s!==k&&!A(n,s,F,3072,3072)&&(k=s,z=j(n,F,N,v,k,M,!1))}F=z.pos,z.blocked&&(v<0&&(C=0),v=0);let B=v>=0&&A(n,k,F+1,3072,3072)?1:0;B?x=0:x<255&&(x+=1);let V=e.wallSide;if(B)V=0,S=255;else{let e=R(n,k,F,-1,1)===0,t=R(n,k,F,1,1)===0;e===t?e&&t?(V=a===0?V:a,S=0):S<255&&(S+=1):(V=e?-1:1,S=0)}return B&&(C=0),h?(a===0||e.vx*a<0||I.blocked||y!==0||T?g=0:u&&(g=_*a===i.runSpeed||g>=(i.sprintDelay??0)&&_*a>i.runSpeed?g<255?g+1:g:0),{x:k,y:F,vx:_+0,vy:v+0,ground:B,air:x,wallSide:V,wallAir:S,slide:y,buffer:D,held:o,jumping:C,lock:c,lockDir:l,sprint:g}):{x:k,y:F,vx:_+0,vy:v+0,ground:B,air:x,wallSide:V,wallAir:S,slide:y,buffer:D,held:o,jumping:C,lock:c,lockDir:l}}let B=1024,V=2048;function ne(e,t,n){let r=f,i=t*r,a=n*r,o=r-2*B;switch(e){case 4:return{x:i+B,y:a+r-V,w:o,h:V};case 5:return{x:i+B,y:a,w:o,h:V};case 6:return{x:i+r-V,y:a+B,w:V,h:o};case 7:return{x:i,y:a+B,w:V,h:o};default:throw RangeError(`spikeBox : la tuile ${e} n'est pas un pic`)}}function re(e,t){return e.x<t.x+t.w&&t.x<e.x+e.w&&e.y<t.y+t.h&&t.y<e.y+e.h}let ie=(e,t,n)=>e<t?t:e>n?n:e;function ae(e,t,n){let r=e-ie(e,n.x,n.x+n.w),i=t-ie(t,n.y,n.y+n.h);return r*r+i*i}function oe(e,t,n,r){return ae(e,t,r)<n*n}function H(e){return{status:0,time:0,player:I(e),tiles:e.tiles,crumbles:e.crumbles.map(()=>0),sections:e.sections.map(()=>-1),deathCause:0,deathX:0,deathY:0,deathTicks:0,springCell:-1,springTime:0,checkpoint:-1}}function se(e,t){let n=e.checkpoints[t.checkpoint],r=t.sections.map((t,r)=>e.sections[r].c1>=n.col?-1:t);return{...H(e),status:1,time:t.time,player:I({...e,start:n}),sections:r,checkpoint:t.checkpoint}}function ce(e,t,n){let r=e.saws[n];if(r.section<0)return 0;let i=t.sections[r.section];return i<0?0:t.time-i}function le(e){return{x:e.x,y:e.y,w:M,h:N}}function ue(e,t){let n=t.player;if(n.y+3072>e.height*4096)return 3;let r=le(n),i=O(n.x),a=O(n.x+M-1),o=O(n.y)<0?0:O(n.y),s=O(n.y+N-1);for(let t=o;t<=s;t++)for(let n=i;n<=a;n++){if(n<0||n>=e.width)continue;let i=e.tiles[t*e.width+n];if(h(i)&&re(r,ne(i,n,t)))return 1}for(let n=0;n<e.saws.length;n++){let i=e.saws[n],a=D(i,ce(e,t,n));if(oe(a.x,a.y,i.radius,r))return 2}return 0}function de(e,t){let n=f;return re(le(t),{x:e.finish.col*n,y:e.finish.row*n,w:n,h:n})}function fe(e,t){return t===e.tiles?e:{width:e.width,height:e.height,tiles:t}}function pe(e,t,n){return t<0||n<0||t>=e.width||n>=e.height?-1:n*e.width+t}function U(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=t&4?1:0;if(e.status===3)return e;if(e.status===2){let t=e.deathTicks+1,r=e.checkpoint>=0?e.time+1:e.time;if(t<18)return{...e,deathTicks:t,time:r};if(e.checkpoint>=0){let t=se(n,{...e,time:r});return i&&(t.player={...t.player,held:1}),t}let a=H(n);return i&&(a.player={...a.player,held:1}),a}if(e.status===0){let n=t&3;if(!(n===1||n===2||i===1&&e.player.held===0))return e.player.held===i?e:{...e,player:{...e.player,held:i}}}let a=f,o=e.tiles,s=e.crumbles;for(let t=0;t<s.length;t++){let r=s[t];if(!(r<=0)&&(s===e.crumbles&&(s=[...s]),s[t]=r>1?r-1:-1,r===1)){o===e.tiles&&(o=[...o]);let r=n.crumbles[t];o[r.row*n.width+r.col]=0}}let c=z(e.player,t,fe(n,o),r),l=c.ground===1,u=O(c.x),d=O(c.x+M-1),m=e.springCell,h=e.springTime;if(l&&r.springSpeed>0){let t=O(c.y+N),i=O(c.x+p(M,2)),a=-1;for(let e of[i,u,d]){let r=pe(n,e,t);if(r>=0&&o[r]===3){a=r;break}}if(a>=0){let t=r.springSpeed<2048?r.springSpeed:P;c={...c,vy:-t,ground:0,air:255,jumping:0,buffer:0},m=a,h=e.time+1}}let g=(t,i)=>{let a=pe(n,t,i);if(a<0)return;let o=n.crumbleIndex[a];o<0||s[o]!==0||(s===e.crumbles&&(s=[...s]),s[o]=r.crumbleDelay>1?r.crumbleDelay:1)};if(l){let e=O(c.y+N);for(let t=u;t<=d;t++)g(t,e)}else{let e=(t&2?1:0)-(t&1?1:0),n=O(c.y),r=O(c.y+N-1);if(e>0&&(c.x+3072)%a==0)for(let e=n;e<=r;e++)g(O(c.x+M),e);if(e<0&&c.x%a==0)for(let e=n;e<=r;e++)g(O(c.x)-1,e)}let _=e.time+1,v=e.sections,y=O(c.x+p(M,2));for(let t=0;t<v.length;t++){let r=n.sections[t];v[t]>=0||y<r.c0||y>r.c1||(v===e.sections&&(v=[...v]),v[t]=_)}let b={...e,status:1,time:_,player:c,tiles:o,crumbles:s,sections:v,springCell:m,springTime:h};if(de(n,c))return{...b,status:3};let x=ue(n,b);if(x!==0)return{...b,status:2,deathCause:x,deathX:c.x+p(M,2),deathY:c.y+p(N,2),deathTicks:0};let S=O(e.player.x+p(M,2));if(y>S){let e=b.checkpoint;for(let t=0;t<n.checkpoints.length;t++){let r=n.checkpoints[t].col;S<r&&r<=y&&(e=t)}if(e!==b.checkpoint)return{...b,checkpoint:e}}return b}T(`
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
`),Object.freeze({floorRow:26,start:3,steps:[[33,1],[38,2],[43,3],[48,4]],coyoteLedge:57,gaps:[[75,2],[81,3],[88,4],[96,5],[105,6]],lowGaps:[[115,4,23],[124,3,24]],corridor:[133,10],chimneys:[[149,3],[154,2]],chimneyTopRow:16,wall:[163,12],slab:[171,18],slabHoles:[175,180,181,186],finish:193}),T(`
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
`),T(`
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
`);let W=72e3,me=/^[a-z0-9_:-]{1,40}$/;var G=class extends Error{code;constructor(e,t){super(t),this.code=e,this.name=`JumpReplayError`}};Object.freeze({checkpoint:-1,held:0,time:0,sections:Object.freeze([]),elan:0});function he(e){let t=0;for(let n of e)t+=n.count;return t}function ge(e){let t=[];for(let n of e){let e=t[t.length-1];e&&e.bits===n?e.count++:t.push({count:1,bits:n})}return t}function _e(e){let t=[];for(let n of e)for(let e=0;e<n.count;e++)t.push(n.bits);return t}function ve(e){if(!me.test(e))throw new G(`format`,`Identifiant de niveau invalide : « ${e} »`)}function ye(e){ve(e.levelId);let t=e.start,n=[1];u(n,e.simVersion),n.push(e.levelId.length);for(let t=0;t<e.levelId.length;t++)n.push(e.levelId.charCodeAt(t));let r=t.checkpoint>=0;if(r&&t.elan)throw new G(`format`,`Départ lancé sur un point de passage`);if(n.push(!!t.held|(r?2:0)|(t.elan?4:0)),r){u(n,t.checkpoint),u(n,t.time),u(n,t.sections.length);for(let e of t.sections)u(n,e+1)}let i=0;for(let t of e.runs){if(!Number.isInteger(t.count)||t.count<1)throw new G(`format`,`Série vide`);if(!Number.isInteger(t.bits)||t.bits<0||t.bits>7)throw new G(`format`,`Commande invalide : ${t.bits}`);if(i+=t.count,i>W)throw new G(`length`,`Rediffusion trop longue (plus de ${W} pas)`);u(n,t.count*8+t.bits)}return c(n)}function be(e){if(typeof e!=`string`||e.length===0)throw new G(`format`,`Rediffusion vide`);let t;try{t=l(e)}catch(e){throw e instanceof o?new G(`format`,`Rediffusion illisible (${e.message})`):e}let n=0,r=()=>{let e=t[n++];if(e===void 0)throw new G(`format`,`Rediffusion tronquée`);return e},i=e=>{try{return d(r)}catch(t){throw t instanceof o?new G(`format`,`${e} : entier trop long`):t}},a=r();if(a!==1)throw new G(`format`,`Format de rediffusion inconnu (${a})`);let s=i(`Version`),c=r(),u=``;for(let e=0;e<c;e++)u+=String.fromCharCode(r());ve(u);let f=r();if(f&-8)throw new G(`format`,`Drapeaux de départ inconnus`);if(f&2&&f&4)throw new G(`format`,`Départ lancé sur un point de passage`);let m={checkpoint:-1,held:f&1?1:0,time:0,sections:[],elan:f&4?1:0};if(f&2){let e=i(`Point de passage`),t=i(`Chrono`),n=i(`Sections`);if(e>=4096)throw new G(`format`,`Point de passage hors limites`);if(t>W)throw new G(`length`,`Chrono de départ trop long`);if(n>256)throw new G(`format`,`Trop de sections`);let r=[];for(let e=0;e<n;e++){let e=i(`Section`)-1;if(e>t)throw new G(`format`,`Section mise en marche après le départ`);r.push(e)}m.checkpoint=e,m.time=t,m.sections=r}let h=[],g=0;for(;n<t.length;){let e=i(`Série`),t=e%8,n=p(e-t,8);if(n<1)throw new G(`format`,`Série vide`);if(g+=n,g>W)throw new G(`length`,`Rediffusion trop longue (plus de ${W} pas)`);h.push({count:n,bits:t})}return{simVersion:s,levelId:u,start:m,runs:h}}function xe(e,t){if(t.checkpoint<0){let n=H(e);return!t.held&&!t.elan?n:{...n,player:{...n.player,held:+!!t.held,vx:t.elan?F.runSpeed:0}}}if(t.elan)throw new G(`format`,`Départ lancé sur un point de passage`);if(t.checkpoint>=e.checkpoints.length)throw new G(`level`,`Point de passage ${t.checkpoint} absent de ce niveau`);if(t.sections.length!==e.sections.length)throw new G(`level`,`Nombre de sections différent de celui du niveau`);let n=se(e,{...H(e),checkpoint:t.checkpoint,time:t.time,sections:t.sections});return t.held?{...n,player:{...n.player,held:1}}:n}function Se(e){return{checkpoint:e.checkpoint,held:e.player.held,time:e.time,sections:[...e.sections],elan:0}}function Ce(e,t,n){if(t.simVersion!==3)throw new G(`version`,`Rediffusion d'une autre version de la simulation (${t.simVersion}, actuelle 3)`);if(n!==void 0&&t.levelId!==n)throw new G(`level`,`Rediffusion d'un autre niveau (« ${t.levelId} »)`);if(he(t.runs)>W)throw new G(`length`,`Rediffusion trop longue (plus de ${W} pas)`);return xe(e,t.start)}function we(e,t){return t.status===3||t.status===2&&e.status!==2&&t.checkpoint<0}function Te(e,t,n){let r=Ce(e,t,n),i=[],a=[],o={start:{...t.start,sections:[...t.start.sections]},startTick:0,runs:[],ticks:0},s=0,c=!1;for(let n of t.runs)for(let t=0;t<n.count;t++){if(c)throw new G(`format`,`Pas après la fin de l'essai (pas ${s+1})`);let t=r;if(r=U(t,n.bits,e,F),s++,o){let e=o.runs[o.runs.length-1];e&&e.bits===n.bits?e.count++:o.runs.push({count:1,bits:n.bits}),o.ticks++}if(r.status===2&&t.status!==2){let e={cause:r.deathCause,x:r.deathX,y:r.deathY};i.push({tick:s,time:r.time,...e,life:a.length}),o&&a.push({index:a.length,...o,end:`mort`,death:e}),o=null}else r.status===1&&t.status===2?o={start:Se(r),startTick:s,runs:[],ticks:0}:r.status===3&&t.status!==3&&o&&(a.push({index:a.length,...o,end:`arrivée`,death:null}),o=null);we(t,r)&&(c=!0)}return o&&o.ticks>0&&a.push({index:a.length,...o,end:`abandon`,death:null}),{finished:r.status===3,ticks:s,time:r.time,deaths:i,lives:a,final:r}}let Ee=/* @__PURE__ */ `id: ascenseur
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
variante: plaque=1
variante: plaque=2
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
variante: haut=5 ecart=2
variante: haut=5 ecart=2 +fosse
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
variante: haut=1 cycle=390
variante: haut=2 cycle=480
variante: haut=3 cycle=420
variante: haut=1 cycle=390 +denivele:3
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
variante: large=2 haut=2
variante: large=1 haut=3
variante: large=1 haut=1 +garde
variante: large=2 haut=1 +fosse
variante: large=1 haut=2 +denivele:2
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
variante: large=1 haut=2
variante: large=2 haut=4
variante: large=2 haut=4 +fosse +denivele:3
variante: large=1 haut=6 +denivele:-2
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
intention: Enchaîner les ressorts au-dessus d'une fosse à pics, puis rebondir en arrière contre un mur hérissé pour le franchir.
etiquettes: mural ressort precision
famille: demi-tour
enchainement: long
mutateurs: sol-friable plafond denivele
format: 3
paliers: 9 11
repeter: ecart colonnes 49-49
variante: ecart=1
variante: ecart=1 +denivele:2
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
##^^***^^^^^^^^***^^^^^^^^***^^^^^^^^***^^^.............
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
variante: large=1 +patrouille
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
variante: cycle=360
variante: cycle=240
variante: cycle=300 +sol-friable
variante: cycle=360 +plafond:pics
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
variante: large=3
variante: large=3 +ressort
variante: large=1 +ressort
variante: large=1 +denivele:2
variante: large=2 +ressort
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
variante: trou=3
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
variante: fenetre=2
variante: fenetre=1
variante: fenetre=1 +denivele:2
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
variante: haut=2
variante: haut=4
variante: haut=6
variante: haut=4 +plafond:pics
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
variante: haut=5
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
variante: haut=5 +garde
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
variante: cycle=180 +fosse
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
mutateurs: sol-friable denivele
format: 3
paliers: 10 10
repeter: pics colonnes 4-4
repeter: pics colonnes 9-9
repeter: pics colonnes 14-14
repeter: pics colonnes 19-19
variante: pics=1
variante: pics=2
variante: pics=3
variante: pics=2 +sol-friable
variante: pics=1 +denivele:2
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
(id: plongeon
intention: Plonger d'une corniche haute dans un couloir bas où une scie roule au sol, et la sauter sans se cogner au plafond.
etiquettes: scie vertical
famille: plongeon
mutateurs: sol-friable
format: 3
paliers: 6 16
variante: cycle=240
variante: cycle=300
variante: cycle=240 +sol-friable
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
variante: ecart=1 cycle=420
variante: ecart=1 cycle=300
variante: ecart=1 cycle=480 +fosse
variante: ecart=1 cycle=420 +plafond
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
variante: large=1 ecart=2
variante: large=1 ecart=2 +garde
variante: large=1 ecart=3 +denivele:1
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
variante: cycle=180
variante: cycle=240
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
variante: ecart=2
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
mutateurs: sol-friable denivele
format: 3
paliers: 10 10
variante: cycle=240
variante: cycle=180
variante: cycle=240 +sol-friable
variante: cycle=180 +denivele:2
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
(id: scie-sol
intention: Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires.
etiquettes: scie
famille: scie-sol
mutateurs: patrouille sol-friable denivele
format: 3
paliers: 10 10
variante: cycle=300
variante: cycle=240
variante: cycle=180
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
variante: large=1 +sol-friable
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
variante: trou=1
variante: trou=1 +denivele:2
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
variante: long=3
variante: long=4
variante: long=3 +denivele:2
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
`.split(`(`),De={jumpSimVersion:3,exigenceVersion:3,modules:{ascenseur:{variants:[{grid:`e99e544f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowAJICVsIDVvIG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,895],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowBIoBZoIETtoG`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`48c29b3f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxAOoCZsIDTpIG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,970,845],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxBKICdtIDNvoF`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,860],raccord:1e3,exigence:2}},{grid:`816c738f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyAIoCZvoEVuIG`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyBIoBdvoEZuoG`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`e7a3286b`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjozAIICXsoDVvIG`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjozBKoBbroDZuIG`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`7e1d7957`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo0AIIDZoIEVuIG`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo0BIoBhgHqBF7yBg`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`7b4e0889`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo1ANoCfroDZvoF`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjo1BLoCbroDXtoF`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,960,860],raccord:1e3,exigence:2}}]},"cheminee-pics":{variants:[{grid:`9f932a66`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MADCAzBE5QEQ1gESZkUiQVayCA`,ticks:304,entryTick:0,exitTick:297,fastest:293,gigue:[1e3,630,305],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MATyAjAk7QEg1gESZkUKST7aCA`,ticks:293,entryTick:17,exitTick:286,fastest:267,gigue:[995,610,290],raccord:1e3,exigence:0}},{grid:`6a2ba0e7`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQDCAzA8tQEStgEqhgMarAFBLdoBJvIG`,ticks:346,entryTick:0,exitTick:339,fastest:339,gigue:[980,465,245],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQTyAjAM7QEIxgESjgMSrAFBJaIBZvIG`,ticks:335,entryTick:17,exitTick:328,fastest:308,gigue:[1e3,620,370],raccord:1e3,exigence:0}},{grid:`69377583`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgDKAzhkpQEI1gEqZk0aOU66CA`,ticks:303,entryTick:0,exitTick:296,fastest:293,gigue:[915,505,280],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgT6AjAc7QEYzgEabkUSSUbCCA`,ticks:292,entryTick:17,exitTick:286,fastest:267,gigue:[970,675,375],raccord:1e3,exigence:0}}]},"cheminee-quinconce":{variants:[{grid:`ba52134b`,arret:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZTowALoDXgpOCh4kRQpeCl4lCR1GCl4lCn4KHmQg5gMihgG6CD6yAw7qAjbiAmaiBg`,ticks:668,entryTick:0,exitTick:661,fastest:661,gigue:[565,100,15],raccord:null,exigence:0},elan:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZTowBOoCVgpOCh5EJQpeCl4lCR1GCj5VCn4KDmwY5gMihgGyCEaKAy7qAj7iAlayBg`,ticks:657,entryTick:17,exitTick:650,fastest:633,gigue:[790,145,35],raccord:1e3,exigence:0}},{grid:`ce6dc7f3`,arret:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZToxALoDXgpOChZsCl4KXiUJHVYKLkUKfgoeZCDmAyKGAaIITpoDJuoCPuICbpoG`,ticks:668,entryTick:0,exitTick:661,fastest:661,gigue:[585,185,45],raccord:null,exigence:0},elan:{code:`AQMbbW9kdWxlOmNoZW1pbmVlLXF1aW5jb25jZToxBOoCXgpGCh5EJQpeCl4lCR1GCl4lCn4KHmQg5gMihgG6CDaSAyb6AjbiAlayBg`,ticks:657,entryTick:17,exitTick:650,fastest:633,gigue:[605,55,0],raccord:1e3,exigence:0}}]},"cheminee-scie":{variants:[{grid:`0451e236`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MAD6AX4JKkGFAgoWvAFCNsUBCTX6AQ6SBg`,ticks:293,entryTick:0,exitTick:286,fastest:286,gigue:[995,655,375],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MATyAkwNETVuCh5ENSY5_gESFnBRJqICJuIF`,ticks:301,entryTick:17,exitTick:295,fastest:279,gigue:[595,215,125],raccord:1e3,exigence:0}},{grid:`90fb25c1`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQDCA84BIjRtIGZonQIK7gdK`,ticks:303,entryTick:0,exitTick:297,fastest:297,gigue:[900,580,315],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQTqAuYBCh4cVUhUGWJlFp0BCSUcogImygU`,ticks:294,entryTick:17,exitTick:287,fastest:267,gigue:[675,395,225],raccord:1e3,exigence:0}},{grid:`205ff16a`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgDCA94BCiYkTTQSvgESDgy9AQwKRpoCJroF`,ticks:295,entryTick:0,exitTick:289,fastest:289,gigue:[790,490,290],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgTyAt4BCiYUTUwKrgESFiy1ARo-sgIWugU`,ticks:288,entryTick:17,exitTick:281,fastest:264,gigue:[995,775,465],raccord:1e3,exigence:0}},{grid:`725007d3`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwD6AX4JKkGNAgoOpAEyVsUBCT2SCA`,ticks:293,entryTick:0,exitTick:286,fastest:286,gigue:[1e3,650,435],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwTqAghcCRWOAQoeJCVOSeYBEi54QSa6CA`,ticks:304,entryTick:17,exitTick:297,fastest:279,gigue:[805,160,60],raccord:1e3,exigence:0}}]},"cheminee-vide":{variants:[{grid:`9273d9b2`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MADCAWaiApQBCl4IXAktNgouNQgs9gRS`,ticks:232,entryTick:0,exitTick:225,fastest:225,gigue:[1e3,890,730],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MATqAYYCIkQlCmYKNiQhhgVa`,ticks:196,entryTick:17,exitTick:189,fastest:171,gigue:[1e3,855,780],raccord:1e3,exigence:3}},{grid:`e61c696d`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQDqAXbCAl4kVSIgxgEiVlUiZURGJIoF`,ticks:281,entryTick:0,exitTick:274,fastest:274,gigue:[1e3,990,855],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQTqAc4BCr4BCHw9MjU2ZIoF`,ticks:212,entryTick:17,exitTick:205,fastest:191,gigue:[1e3,595,420],raccord:1e3,exigence:0}},{grid:`46b25800`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MgDSAW6SAowBCl4IXAktZAktZgqeBUI`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MgTqAcYBCl4KHmQKfgoeRCFmJdoE`,ticks:204,entryTick:17,exitTick:198,fastest:181,gigue:[1e3,675,445],raccord:1e3,exigence:0}},{grid:`b1abc18e`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MwAipgIhFI4DKpYDCf4EGh6KBQ`,ticks:317,entryTick:0,exitTick:311,fastest:310,gigue:[1e3,1e3,900],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MwTqAYYCIkQlCl4KPiQhhgVa`,ticks:196,entryTick:17,exitTick:189,fastest:171,gigue:[1e3,780,750],raccord:1e3,exigence:3}},{grid:`483d871a`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NADiAW7SAmYsRSIgbkiVASZAJCWmBVo`,ticks:271,entryTick:0,exitTick:264,fastest:264,gigue:[960,820,560],raccord:null,exigence:5},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NATqAb4BCpYBCi5kYdYFWg`,ticks:202,entryTick:17,exitTick:196,fastest:179,gigue:[1e3,715,510],raccord:1e3,exigence:5}},{grid:`785c1e21`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NQDqAWb6AZQBCCxlCS1mCi41NJYEWg`,ticks:221,entryTick:0,exitTick:214,fastest:214,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NQTqAa4BEp4BCi5lCCw1ogU`,ticks:185,entryTick:17,exitTick:178,fastest:161,gigue:[1e3,530,365],raccord:1e3,exigence:0}}]},cheminee:{variants:[{grid:`4bd534e7`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAAugNeCm4VECxFCoQBCCxlElYp4gE-ggY`,ticks:280,entryTick:0,exitTick:273,fastest:273,gigue:[720,315,140],raccord:null,exigence:0},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAE6gJOEm4KHnQQhgEiRiUgZoICNvIF`,ticks:269,entryTick:17,exitTick:262,fastest:244,gigue:[990,515,260],raccord:1e3,exigence:0}},{grid:`33488765`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEAwgPeARIWJE1EIqYBCh4khQEKfuIBJvIG`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[990,670,510],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEE6gLmAQoeJEVEIqYBEhYkhQEKfoICJtIG`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[1e3,760,555],raccord:1e3,exigence:5}},{grid:`2a4d0379`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIAwgPmAQoeHE1EIqYBCh4khQEKjgHiCA`,ticks:314,entryTick:0,exitTick:307,fastest:307,gigue:[1e3,780,695],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIE6gLeARIeHE1EIqYBCh4khQEKngHSCA`,ticks:303,entryTick:17,exitTick:296,fastest:279,gigue:[1e3,755,750],raccord:1e3,exigence:3}},{grid:`7ac96d5f`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjMAwgNWCn4KNkUKVi0JRSQKjgEKLmUKXoICfroF`,ticks:308,entryTick:0,exitTick:302,fastest:302,gigue:[665,280,140],raccord:null,exigence:0},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjME6gJWCm4KDoQBEF4KpgEKHkQKpgEaVuICRpIF`,ticks:301,entryTick:17,exitTick:294,fastest:275,gigue:[965,390,135],raccord:1e3,exigence:0}}]},"chute-pics":{variants:[{grid:`c272a5cc`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MABiPtoDoQJiMaICNNoD`,ticks:233,entryTick:0,exitTick:227,fastest:227,gigue:[915,725,715],raccord:null,exigence:4},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MASSAR6iA4ABoQHiAUDiASTSAw`,ticks:235,entryTick:17,exitTick:228,fastest:211,gigue:[1e3,935,795],raccord:1e3,exigence:3}},{grid:`fca5c7ac`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MQBiNsoD0QKCAjDKATa6Aw`,ticks:241,entryTick:0,exitTick:235,fastest:235,gigue:[815,855,740],raccord:null,exigence:3},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MQSKASaiA4ABwQHCAiDCASaiAmZK`,ticks:242,entryTick:17,exitTick:236,fastest:219,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`3e2b1c34`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MgCSATZ6YEqRAdAC8gEwsgNgkgE`,ticks:240,entryTick:0,exitTick:233,fastest:232,gigue:[1e3,915,745],raccord:null,exigence:3},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MgSiARaKAtECmgJZ8gE0ogIxigE`,ticks:238,entryTick:17,exitTick:232,fastest:213,gigue:[1e3,950,820],raccord:1e3,exigence:3}},{grid:`19989458`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MwBiNtoDqQIyKYoDNMID`,ticks:236,entryTick:0,exitTick:229,fastest:229,gigue:[825,790,735],raccord:null,exigence:3},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6MwSKASbiAiDBAoABwgMmogEgQcIB`,ticks:241,entryTick:17,exitTick:234,fastest:217,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`2200b1dc`,arret:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6NABiNuIDoQJgMaIClgRK`,ticks:243,entryTick:0,exitTick:236,fastest:236,gigue:[1e3,990,940],raccord:null,exigence:2},elan:{code:`AQMTbW9kdWxlOmNodXRlLXBpY3M6NASSAR44KXosQSIggQGgAiEgggLGBEo`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[955,910,915],raccord:1e3,exigence:2}}]},corniches:{variants:[{grid:`fd953b95`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczowAMIBhgHCA4YMQg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczowBIoBhgGiA4YBygs`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a6e04ff6`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoxAMIBxgQyhg9K`,ticks:351,entryTick:0,exitTick:344,fastest:344,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoxBIoBxgQy1g5a`,ticks:340,entryTick:17,exitTick:334,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d4aff602`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoyAMIBhgHCA4YMQg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczoyBIoBhgGiA4YBygs`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0b3041f6`,arret:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczozAMIBxgQyhg9K`,ticks:351,entryTick:0,exitTick:344,fastest:344,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmNvcm5pY2hlczozBIoBxgQy1g5a`,ticks:340,entryTick:17,exitTick:334,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"demi-tour-ressorts":{variants:[{grid:`07cf220e`,arret:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czowAIIDDsoYMGGCA6ABaYIBQMYB6gY`,ticks:698,entryTick:0,exitTick:691,fastest:692,gigue:[1e3,915,750],raccord:null,exigence:3},elan:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czowBPICDroRSBowSgkKGBEyERAyGQoQUigiKAohGhEwGUAaCTIxMjGKAVgKIBowGhkYMhkgIigSMBowGhkYGu4BkgY`,ticks:690,entryTick:17,exitTick:683,fastest:666,gigue:[650,455,375],raccord:1e3,exigence:0}},{grid:`79bf773e`,arret:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czoxAIoDDsoYKGn6AiApYDliICIxMiSOAeoG`,ticks:698,entryTick:0,exitTick:691,fastest:691,gigue:[965,765,585],raccord:null,exigence:5},elan:{code:`AQMbbW9kdWxlOmRlbWktdG91ci1yZXNzb3J0czoxBPoCDroRIDIYOhk6CAk6ERAKITowKiAKMCIZEiFAIRASGRoxUiGCATAaUCooCiEoMgkYGjAaMBowGhkYMs4BigY`,ticks:688,entryTick:17,exitTick:682,fastest:666,gigue:[545,485,405],raccord:1e3,exigence:0}}]},"demi-tour":{variants:[{grid:`545deeae`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowAIoBrgEqjgQy9gdi`,ticks:252,entryTick:0,exitTick:245,fastest:245,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowBJoBFvoCKHUO3QEgdiUs2gU`,ticks:233,entryTick:17,exitTick:227,fastest:214,gigue:[855,670,655],raccord:1e3,exigence:4}},{grid:`d8011005`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxACLGAgreBCKmCEI`,ticks:264,entryTick:0,exitTick:258,fastest:256,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxBIoBLp0BCr4EMqYISg`,ticks:260,entryTick:17,exitTick:253,fastest:236,gigue:[1e3,1e3,925],raccord:1e3,exigence:2}},{grid:`d5734b47`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyADrWAVqeAbIECFIIHK4Bqgc`,ticks:286,entryTick:0,exitTick:279,fastest:281,gigue:[1e3,995,910],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyBIoBNo0BCsYFMsYIUg`,ticks:281,entryTick:17,exitTick:274,fastest:258,gigue:[1e3,990,855],raccord:1e3,exigence:2}},{grid:`5912db5a`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjozACLGAgrWBBLGAboH`,ticks:264,entryTick:0,exitTick:258,fastest:259,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjozBIoBJs0BCqYFMsYHQg`,ticks:265,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,960,900],raccord:1e3,exigence:2}},{grid:`d45c7b1e`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo0ADKuAgq2BSL-BkI`,ticks:253,entryTick:0,exitTick:246,fastest:247,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo0BJoBJuICGHUOhQIIVjQVLOIF`,ticks:233,entryTick:17,exitTick:226,fastest:214,gigue:[970,845,765],raccord:1e3,exigence:3}},{grid:`16421e95`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo1AIoBtgEqhgQylgQK7gdS`,ticks:316,entryTick:0,exitTick:309,fastest:309,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjo1BIoBRsICELUBJOUBGt4CEuYHQg`,ticks:301,entryTick:17,exitTick:294,fastest:280,gigue:[1e3,885,720],raccord:1e3,exigence:3}}]},"descente-scies":{variants:[{grid:`7115a1e3`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAA0h5Gqgs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAE4h1Wsgs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`77a115e7`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEAog9Oug5Wygs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,955,835],raccord:null,exigence:3},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEEkg822g5Gigs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[875,790,690],raccord:1e3,exigence:4}},{grid:`3bde3553`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIA6hZOihM`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIE-hVWmhM`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`e69500a3`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjMAuio`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjME4ik`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`72dcc3f7`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQAog9Wog5mygs`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,895],raccord:null,exigence:2},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQEug5W4g5Osgs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,835],raccord:1e3,exigence:3}},{grid:`e545e603`,arret:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUAiiFO6gg`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUE8h1Gsgs`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,935],raccord:1e3,exigence:2}}]},descente:{variants:[{grid:`4a1cf642`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAAwgEmug8`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAEigEm4gYmmgg`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`42a79a95`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEAyhQ`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEE-hM`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d4d4cc2d`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIAghg`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIEqhc`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0f508098`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjMAyhQ`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjME-hM`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"escalier-friable":{variants:[{grid:`1be7cff6`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MADCAW6iArYB4gKOAYIDlgGCA6YFQg`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,830],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MASKAWa6AnbaAm7KApYBggNm8gU`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,945,715],raccord:1e3,exigence:4}},{grid:`265c9667`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQCaAb4EElaSAk7aAXbyAdYFYg`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[655,255,215],raccord:null,exigence:0},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQSaAV6aApYB0gJmogJmkgFhZjTGBEI`,ticks:313,entryTick:17,exitTick:306,fastest:284,gigue:[790,635,320],raccord:1e3,exigence:0}},{grid:`ea4fafd2`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgDKAV6iApYBggPGBDLWCEI`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,815,560],raccord:null,exigence:5},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgSKAWaaAp4B0gLGBDLWCFI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,955,725],raccord:1e3,exigence:3}}]},"escalier-scies":{variants:[{grid:`d6e5c5a1`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjAAwgGmBRJuogK2AfoClgH6As4EKm6iAsYEMsYEKv4HSg`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[995,765,490],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjAEkgGWAfoCpgHyAsYEMm7CAqYB-gLGBCp--gK-BDL2B2I`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[1e3,620,335],raccord:1e3,exigence:0}},{grid:`e66e72d9`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjEAwgGmBSJmogKuAfoCjgH6AqYBigOuAeICxgQyZpoCtgHSCA`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[910,400,170],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjEEigHuBBKOAfICdqICpgQitgHaAr4B4gL2BBJmogLGCUI`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[945,540,240],raccord:1e3,exigence:0}},{grid:`d51c1cd5`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjIAwgG-BRpeogKuAfICngH6Ap4B-gLGBDJmogL2BBq2CFI`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[1e3,695,440],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjIEigHGBCKmAfICfroCpgQirgHKAr4B4gL-BBJ2ogKmCUI`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[1e3,830,640],raccord:1e3,exigence:4}},{grid:`4e0aa0f5`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjMAwgHOBRJemgKeAeICtgH6As4EGn6iAsYEMsYEMvYHSg`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[990,710,385],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjMEigH-BBp2ugLOBCJmogLGBCqGAdoCxgQixgQiZuIH`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[890,675,305],raccord:1e3,exigence:0}},{grid:`614569cb`,arret:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjQAwgHGBRJeogKuAfICngH6ApYBggOWAYID5gQSZroCjgHaCA`,ticks:711,entryTick:0,exitTick:705,fastest:705,gigue:[950,295,110],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOmVzY2FsaWVyLXNjaWVzOjQEygGmBCKGAYIDbpoCxgQixgQiZqICxgQihgHaAo4B4gg`,ticks:701,entryTick:17,exitTick:694,fastest:677,gigue:[600,225,55],raccord:1e3,exigence:0}}]},escalier:{variants:[{grid:`a9813758`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAAogGGAYID5gMqvgZi`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAEigFm4gLuAxrmBkI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,865],raccord:1e3,exigence:2}},{grid:`6b009647`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEAugFusgKGAfICdoIDZoIDtgZq`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,895,685],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEEkgFeugJu4gKGAYIDZqICpgdK`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,930,650],raccord:1e3,exigence:4}},{grid:`c0ff542e`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIAsgGGAeoCngHCCtYFag`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIEigF28gKWAdIIxgdK`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d63bad47`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjMAsgF--gLmAyq-BmI`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjMEkgFm2gKGBAreBkI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,925],raccord:1e3,exigence:2}},{grid:`eea904c6`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjQAugFuggPmAzK2BmI`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,980,880],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjQEwgLuAyreCEI`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ce310861`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjUAwgFuqgKGAdII9gRi`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,980,820],raccord:null,exigence:3},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjUEogFu6gJW-gemBUo`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,940,765],raccord:1e3,exigence:3}}]},"grande-scie":{variants:[{grid:`42f0de9f`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAA2gMO4gQOmgU`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,940,760],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAEigMO2gQOmgU`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,920,760],raccord:1e3,exigence:3}},{grid:`172d8193`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEA4gMOsgUO8gU`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,775,415],raccord:null,exigence:0},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEE-gIOwgUO8gU`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,800,690],raccord:1e3,exigence:4}},{grid:`b4e442e4`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIA6gMWigYWsgY`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[910,280,145],raccord:null,exigence:0},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIEmgMWggYeqgY`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[880,260,140],raccord:1e3,exigence:0}},{grid:`ccac0a33`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjMA2gMOugUO8gU`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,740,635],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjME-gIOygUO6gU`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,770,540],raccord:1e3,exigence:5}},{grid:`aa3adf1f`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjQA4gMO2gQOmgU`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,915,680],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjQEigMO4gQOkgU`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,890,675],raccord:1e3,exigence:4}},{grid:`18cf0211`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjUA2gMO6gMOwgc`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,885,715],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjUE-gIOigQOqgc`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,830,750],raccord:1e3,exigence:3}}]},"iles-friables":{variants:[{grid:`6b0aa634`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MADiAWaKA17iAmb6A5YBigU`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,995,830],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MASKAYYBwgNG8gJWsgOeAZIF`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`095100b2`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQDKAY4BggOmAaIDtgGiA36CA2byAw`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,935,820],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQSKAY4FClbCAv4FEkayAy6KAw`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,900,600],raccord:1e3,exigence:4}},{grid:`2dc14776`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MgDCAWbSAp4BggOGAeoDlgHyBA`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,905,740],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MgSKAYYBwgNG4gJmugOWAZIF`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,845],raccord:1e3,exigence:3}},{grid:`45e40182`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwCCAb4BmgOmAYoDxgGyA3aCA0aSBA`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,985,830],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwSqAeYEEl66Av4FEkaqAz6CAw`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,960,635],raccord:1e3,exigence:4}},{grid:`5bf44276`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NADCAaYB4gNG-gI2ygNOugU`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,910],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NASKAaYBogNmmgM2ugNGugU`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,965,785],raccord:1e3,exigence:3}}]},"iles-scie":{variants:[{grid:`02ec991a`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTowAMoBLvoD_gLaAj7SBg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,880],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTowBIoBNvoCProDLtICNqoG`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,995,895],raccord:1e3,exigence:2}},{grid:`930bf039`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToxANoCDuoCTooELuIDNvoF`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToxBIoBNrIEJuICVooELpIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`98865c4d`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToyAKIBTooEFtoCDsICVtIG`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,950,905],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZToyBIoBFqIDPqoDNtICNqoG`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,970,850],raccord:1e3,exigence:2}},{grid:`93ed21f8`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTozALoBNsIENpIDJvoDJqoG`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,985,830],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTozBIoBNrIELpoDFoIENpIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,990,930],raccord:1e3,exigence:2}},{grid:`6b0a8533`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo0ALIBPoIEhgPSAj7SBg`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,915],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo0BIoBLuoCRpoDHuICZqoG`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[995,980,905],raccord:1e3,exigence:2}},{grid:`37a940af`,arret:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo1ALoBPvIDHsoCJuIJ`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,995,930],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmlsZXMtc2NpZTo1BIoBNrIDNmDyATTqCQ`,ticks:288,entryTick:17,exitTick:281,fastest:262,gigue:[945,910,865],raccord:1e3,exigence:2}}]},lucarne:{variants:[{grid:`181480d2`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MACaAV6aA07KA3aSBw`,ticks:275,entryTick:0,exitTick:268,fastest:266,gigue:[1e3,965,705],raccord:null,exigence:4},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MASKAUaSAnb6A26aBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[895,750,540],raccord:1e3,exigence:5}},{grid:`ea4d366e`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQDKAU7iAkaSA06SCA`,ticks:275,entryTick:0,exitTick:268,fastest:263,gigue:[1e3,660,345],raccord:null,exigence:0},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQSKAUaKAmaiA1aaCA`,ticks:263,entryTick:17,exitTick:256,fastest:239,gigue:[905,590,350],raccord:1e3,exigence:0}},{grid:`3868bc1e`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MgCSAWaiAz7yAk6aCA`,ticks:275,entryTick:0,exitTick:268,fastest:263,gigue:[1e3,780,480],raccord:null,exigence:0},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MgSKAU6SAmaSA1aaCA`,ticks:263,entryTick:17,exitTick:256,fastest:239,gigue:[935,660,355],raccord:1e3,exigence:0}}]},marelle:{variants:[{grid:`5a4bb6e8`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MACKAw6KA74BkgR2-gc`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MASKASbyA26aBl6KBw`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`131de9b2`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MQDCATaiBWa6B3a6Bg`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,910],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MQSKASaSBW6yB3a6Bg`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,930],raccord:1e3,exigence:2}},{grid:`59815a4c`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MgCKAw7qAl6aBW76Bw`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,990,660],raccord:null,exigence:4},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MgSKASbyA16qBl6KBw`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,860],raccord:1e3,exigence:2}},{grid:`35414776`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MwDCATbyBHbaB27CBg`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6MwSKASaKBWbKB36qBg`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,910],raccord:1e3,exigence:2}},{grid:`b3487386`,arret:{code:`AQMQbW9kdWxlOm1hcmVsbGU6NADqAy6SASD1AS5kQSBk-QI6VvICrggKjgHSBg`,ticks:526,entryTick:0,exitTick:519,fastest:522,gigue:[990,940,800],raccord:null,exigence:3},elan:{code:`AQMQbW9kdWxlOm1hcmVsbGU6NASKA64BmgiOAaoG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},"mur-friable":{variants:[{grid:`d54d4a80`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAAkgRWCmYKNjUKLjQtCTU2Ct4DCk6KBA`,ticks:267,entryTick:0,exitTick:261,fastest:261,gigue:[1e3,600,335],raccord:null,exigence:0},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAEqgMuEo4BCiZFCiY0NQktZgouNPoBNroF`,ticks:261,entryTick:17,exitTick:254,fastest:235,gigue:[525,255,155],raccord:1e3,exigence:0}},{grid:`68a5b778`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEAkgRGClYIVAktNgoeRRgsRhJlCn4cmgKWAfoD`,ticks:285,entryTick:0,exitTick:278,fastest:278,gigue:[970,700,360],raccord:null,exigence:0},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEEsgMuCm4KTCUKbglFFhJeCFwJLZYDCo4BggQ`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[765,585,335],raccord:1e3,exigence:0}},{grid:`95d80190`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIAkgRWCj4IXBkdXBElNAmVAQgsZgktNDbyATaiBQ`,ticks:300,entryTick:0,exitTick:293,fastest:293,gigue:[945,385,150],raccord:null,exigence:0},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIEsgMuCnYSLkUSJjQtES1UCQ1mCi5lCsYDCnb6Aw`,ticks:290,entryTick:17,exitTick:284,fastest:266,gigue:[780,685,415],raccord:1e3,exigence:0}},{grid:`d880ca70`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjMAkgRWCkYIVAkdTgoWTQgkPiplCn40ogImygQ`,ticks:285,entryTick:0,exitTick:278,fastest:278,gigue:[995,530,290],raccord:null,exigence:0},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjMEsgMuCmYaNEUKXgldCl4IZAkljgMidoIE`,ticks:274,entryTick:17,exitTick:267,fastest:251,gigue:[625,460,300],raccord:1e3,exigence:0}}]},"mur-seul":{variants:[{grid:`00ae395c`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAAigHeAjK2AyrOATLmBlo`,ticks:275,entryTick:0,exitTick:269,fastest:269,gigue:[1e3,990,855],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAEigGmAgrGAxLuASKGBzo`,ticks:264,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,1e3,920],raccord:1e3,exigence:2}},{grid:`fa64cd78`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEAogHuAgqWAwq-ARCyAoYCIoYHOg`,ticks:335,entryTick:0,exitTick:329,fastest:323,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEEigGGAjCeAwqOAdIC7gESrgGSBg`,ticks:316,entryTick:17,exitTick:310,fastest:293,gigue:[1e3,790,530],raccord:1e3,exigence:5}},{grid:`fe4925d4`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIAigHeAiqOAxKGAaICvgGqAvYBCt4Gag`,ticks:379,entryTick:0,exitTick:372,fastest:372,gigue:[930,635,440],raccord:null,exigence:0},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIEigHGAhKGAxp-sgLGAxr-ASLmBlo`,ticks:376,entryTick:17,exitTick:370,fastest:353,gigue:[1e3,940,705],raccord:1e3,exigence:4}},{grid:`56d5165c`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjMAmgH2AhLmAiLGARC6AoYCIoYHOg`,ticks:335,entryTick:0,exitTick:329,fastest:323,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjMEigGmAhKWAwqOAcoChgIKhgc6`,ticks:316,entryTick:17,exitTick:310,fastest:293,gigue:[1e3,815,640],raccord:1e3,exigence:4}},{grid:`410dbc35`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjQAigHeAjK2AyL-AQrmBlo`,ticks:275,entryTick:0,exitTick:269,fastest:269,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjQEqgGGAgrWAwrmASKGBzo`,ticks:264,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`d0eb2d70`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjUAkgHWAjKGAzLmAwgsZcYEYg`,ticks:282,entryTick:0,exitTick:275,fastest:275,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjUEigH-ARi-AwqWAYICMCI0xgEwigQ`,ticks:268,entryTick:17,exitTick:262,fastest:242,gigue:[1e3,925,775],raccord:1e3,exigence:3}}]},"mur-trous":{variants:[{grid:`ee4ec45f`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czowAMoBPBX2ATCWAxqOAxqeAaIChgGiArYBmgce2gIOygZO4gIm4gc`,ticks:752,entryTick:0,exitTick:745,fastest:744,gigue:[985,935,725],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czowBJIBrgJK_gIStgMK_gIytgMihgHSBFaaBE6yBEbqA2byCA`,ticks:748,entryTick:17,exitTick:741,fastest:717,gigue:[1e3,1e3,935],raccord:1e3,exigence:2}},{grid:`d0bae3bf`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czoxALIB1gISngMKlgMijgMSrgMSvggS_gKiBh7SAj66CA`,ticks:749,entryTick:0,exitTick:742,fastest:743,gigue:[1e3,855,670],raccord:null,exigence:4},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czoxBKIBzgIylgMKjgMQ5gMihgMixgMidroGDuIChgHKBkaaAxbqBw`,ticks:814,entryTick:17,exitTick:807,fastest:780,gigue:[1e3,975,900],raccord:1e3,exigence:2}},{grid:`e9fbf235`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czoyAJIB1gJC9gIqjgMqjgMybsoChgYiTqoEVvIGNtoCTroI`,ticks:773,entryTick:0,exitTick:766,fastest:766,gigue:[1e3,905,665],raccord:null,exigence:4},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czoyBIoBpgIilgMSpgMSjgGyApYBigKmCAoe-gI-8gZeigMmigg`,ticks:762,entryTick:17,exitTick:755,fastest:738,gigue:[1e3,945,820],raccord:1e3,exigence:3}},{grid:`be517c9b`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czozAMIBZOYBIKYDGo4DIoYDIL4DEr4GQiaSA16CBz7iAibyBw`,ticks:754,entryTick:0,exitTick:747,fastest:744,gigue:[1e3,980,890],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czozBIoB7gEoHZYDIpYDGqYDCp4DGq4BkgcOugJG2gY26gIm8gc`,ticks:739,entryTick:17,exitTick:732,fastest:715,gigue:[1e3,940,750],raccord:1e3,exigence:3}},{grid:`a7d093b2`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czo0AJIB1gIyhgMyhgMqjgMShgG6ArYIEiaqAkayBibaAhayCA`,ticks:749,entryTick:0,exitTick:742,fastest:744,gigue:[1e3,925,790],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czo0BIoBpgIyhgMytgMK_gIyrgMifuoERrIERrIEPooERuoI`,ticks:747,entryTick:17,exitTick:740,fastest:717,gigue:[1e3,950,785],raccord:1e3,exigence:3}},{grid:`cd0b2ddb`,arret:{code:`AQMSbW9kdWxlOm11ci10cm91czo1AJIB1gIyhgMilgMyhgMqbsICjgYqVqoEPrIGNqIFNsoG`,ticks:771,entryTick:0,exitTick:765,fastest:766,gigue:[1e3,955,805],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOm11ci10cm91czo1BIoBpgJa_gIStgMK_gIytgMSfsoFTrIEVqoGJqIFNroG`,ticks:768,entryTick:17,exitTick:761,fastest:738,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}}]},"paroi-friable":{variants:[{grid:`3091df75`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MACCAqYDCCyGAzKGAwquAwruB0o`,ticks:381,entryTick:0,exitTick:374,fastest:373,gigue:[1e3,995,960],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MASqAqYCKp4DCpYBqgKWAZIC3gdK`,ticks:369,entryTick:17,exitTick:362,fastest:346,gigue:[1e3,990,940],raccord:1e3,exigence:2}},{grid:`bc652c6d`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQCyAUaCA94CGv4CEq4DEKYDCqYDCvYHQg`,ticks:468,entryTick:0,exitTick:461,fastest:462,gigue:[1e3,945,685],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQSyAsYCEvYCIo4DMoYDMoYDGtYHWg`,ticks:423,entryTick:17,exitTick:417,fastest:400,gigue:[1e3,935,865],raccord:1e3,exigence:2}},{grid:`cf635701`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MgCSASwt6gK9AdYBGoYDGqYDCJ4DCp4DGu4HSg`,ticks:469,entryTick:0,exitTick:462,fastest:462,gigue:[990,815,495],raccord:null,exigence:0},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MgSiAt4CCvYCKoYDKo4DIpYDGtYHWg`,ticks:423,entryTick:17,exitTick:417,fastest:400,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`16d19a55`,arret:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwDCAeYDCp4DIKYDCr4DCt4HQg`,ticks:380,entryTick:0,exitTick:373,fastest:373,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwS6AqYCEqYDEo4BqgKWAZoC3gdC`,ticks:369,entryTick:17,exitTick:362,fastest:346,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}}]},pendule:{variants:[{grid:`1d41c771`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MADyBDbiA1bKBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,940],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MASqBF6yA0bSBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`13c22e84`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MQDiBEbaA07aBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MQSiBFbCA07KBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`80a1e2ec`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MgDiBEbaAz7qBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MgSiBD66A0byBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`d7e5651a`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MwDqBEayBD6KBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6MwSqBGb6AzaSBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,905],raccord:1e3,exigence:2}},{grid:`4a66e837`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NADiBEbaAz7qBw`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NASqBE7KA0bKBw`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}},{grid:`38153124`,arret:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NQCaBD6aA1biCA`,ticks:275,entryTick:0,exitTick:268,fastest:268,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBlbmR1bGU6NQSSAY4B4gZGigc`,ticks:264,entryTick:17,exitTick:257,fastest:240,gigue:[1e3,965,875],raccord:1e3,exigence:2}}]},"petits-trous":{variants:[{grid:`e0eaaf71`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowAKoDFtICHooFHsICJqoG`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,980,930],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowBJoBFooDVpoFFtoCRroG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,995,960],raccord:1e3,exigence:1}},{grid:`9c0be2f4`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxAIoDFvoCXpIHDtICJroG`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,985,870],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxBIoBRqoERvoGJsICJqoG`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,975,855],raccord:1e3,exigence:2}},{grid:`fde6a784`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyALIEXpIDPtoETuIEXuIG`,ticks:417,entryTick:0,exitTick:410,fastest:410,gigue:[1e3,845,850],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyBNoBVpoFNuIEVoIFNuIG`,ticks:406,entryTick:17,exitTick:399,fastest:382,gigue:[1e3,860,785],raccord:1e3,exigence:3}},{grid:`4a6d8121`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czozAKIDDuoCZooHPvICJuoF`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,965],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czozBIoBRrIETuoGNvICJuoF`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,940],raccord:1e3,exigence:2}},{grid:`6ce29527`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czo0ALoBRooFFtICJqIDJooH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,965,990],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czo0BIoBJoIEHuICXpoEHtIG`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,950,930],raccord:1e3,exigence:2}}]},"piliers-scie":{variants:[{grid:`9f278765`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTowALIE_gQingHKCs4FCo4B-gOOAZIDLoIG`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,975,735],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTowBKoDpgUylgGCCTb6Aj6CA5YBqgSWAaIDDvoF`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[1e3,935,775],raccord:1e3,exigence:3}},{grid:`a7e2e900`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToxALIEhgUylgGqBL4BsgfGAdoCFtIDjgGiAx6CBg`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,1e3,770],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToxBKoDpgUylgGSCF6qAYYGCo4B8gPOAaoDJroF`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`bd57f562`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToyALIEvgQ61gG6Cv4EMpYBsgSGAZIDJvoF`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,990,825],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZToyBKoDpgUylgGCCTbaAl6CA5YBugSGAaoDDvIF`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[1e3,895,730],raccord:1e3,exigence:3}},{grid:`177e6495`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTozAOIDhgYSlgHCCCYiJooDNoIDjgG6BHaKAx6CBg`,ticks:677,entryTick:0,exitTick:670,fastest:670,gigue:[960,785,550],raccord:null,exigence:5},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTozBOoCDooDzgUq5gYiJqIEzgHKAh76A3aCAx6CBg`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[1e3,905,725],raccord:1e3,exigence:3}},{grid:`e6605c40`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo0AMoDFqoDhgHyAy6aA7YBkgZWogOGAfoDLvoCNpIH`,ticks:679,entryTick:0,exitTick:672,fastest:672,gigue:[1e3,725,210],raccord:null,exigence:0},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo0BKoDpgUylgGSCE6iAZ4GCo4BugSOAZIDNroF`,ticks:668,entryTick:17,exitTick:661,fastest:644,gigue:[1e3,955,900],raccord:1e3,exigence:2}},{grid:`dc71a245`,arret:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo1ALIE_gQ6lgHCCqYFKo4BggSWAaoJ`,ticks:679,entryTick:0,exitTick:672,fastest:670,gigue:[1e3,1e3,725],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBpbGllcnMtc2NpZTo1BMoDhgUS5gGyCCYiJooDPuICngG6BIYBmgk`,ticks:666,entryTick:17,exitTick:659,fastest:642,gigue:[990,925,690],raccord:1e3,exigence:4}}]},piliers:{variants:[{grid:`aadaf7dd`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MADCAxaqA37aBH6yBg`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,840],raccord:null,exigence:3},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MAT6Ag6KA84B6gOWAdoG`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,995,905],raccord:1e3,exigence:2}},{grid:`da04bc37`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQDqAyaaA07qAg6aA07SAg6aBg`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,945,720],raccord:null,exigence:3},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQTCAw6iAz7CAi6iA0aiAi6iBg`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[985,830,565],raccord:1e3,exigence:5}},{grid:`99611d07`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MgDCAw6qA44B0gR-sgY`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MgSiAXaKBIYB2gR2wgY`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,845],raccord:1e3,exigence:3}},{grid:`1563275b`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MwDyAx6qAz7qAhaqA0bCAiaCBg`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,975,720],raccord:null,exigence:3},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MwSKAaYB8gNW-gIm4gM2kgIuigY`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,910,660],raccord:1e3,exigence:4}},{grid:`dff05069`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6NADKAw6CA-YB4gNmggc`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,940],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6NATqAg7KA54B8gNeigc`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,980,845],raccord:1e3,exigence:3}}]},"plafond-pics":{variants:[{grid:`e80f38a8`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowANIDLpIDLtICJvICNooH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,990,805],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowBLoCHpIDHvICLooDPqoH`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[1e3,785,510],raccord:1e3,exigence:5}},{grid:`33e8198d`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxAIIEPtIDPsIDLroDPpIH`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,790],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxBKIDPtoDPsIDNuIDFooH`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,830],raccord:1e3,exigence:3}},{grid:`dbf36b11`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyAIoEPoIERroEPooETsoH`,ticks:417,entryTick:0,exitTick:410,fastest:410,gigue:[1e3,830,350],raccord:null,exigence:0},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyBKoDNsIENrIENqIERqoH`,ticks:406,entryTick:17,exitTick:399,fastest:382,gigue:[1e3,875,375],raccord:1e3,exigence:0}},{grid:`5fc12515`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczozAOoDPvIDPsIDLtoDNvIG`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,690],raccord:null,exigence:4},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczozBKIDRtIDNuIDPrIDNvoG`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,965,740],raccord:1e3,exigence:3}},{grid:`5f54e552`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczo0AOIDHqIDHpIDLsICFpIH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[825,595,385],raccord:null,exigence:0},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczo0BJIDPooDPooDLqICLliyBg`,ticks:321,entryTick:17,exitTick:314,fastest:297,gigue:[520,290,235],raccord:1e3,exigence:0}}]},plongeon:{variants:[{grid:`8b5d4915`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjAAajaqCd4EUg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[895,840,870],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjAEmgEW4gGJAboBiAHqAv4FUg`,ticks:256,entryTick:17,exitTick:249,fastest:229,gigue:[995,940,855],raccord:1e3,exigence:2}},{grid:`4bcba99e`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjEAajbCCcYEUg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[705,625,530],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjEEmgEW4gGRAaIBkAH6A4YFSg`,ticks:257,entryTick:17,exitTick:250,fastest:229,gigue:[1e3,995,955],raccord:1e3,exigence:1}},{grid:`6859b548`,arret:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjIAei6iCe4EQg`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[945,905,855],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnBsb25nZW9uOjIEmgEWugGRAfIBiAHiAu4FWg`,ticks:257,entryTick:17,exitTick:250,fastest:229,gigue:[1e3,995,935],raccord:1e3,exigence:2}}]},"pont-friable":{variants:[{grid:`94d74f40`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowAJoENuoCJvICJroI`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,995,970],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowBMIDNtoCPuoCJsII`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[990,965,915],raccord:1e3,exigence:2}},{grid:`57b90f55`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxAMoDVooGFsICLooI`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxBIIDVqIGhgPiBw`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6057996b`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyALoGDoIDRoIGJooH`,ticks:373,entryTick:0,exitTick:366,fastest:366,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyBIIEProERvoFJooH`,ticks:362,entryTick:17,exitTick:355,fastest:338,gigue:[1e3,1e3,900],raccord:1e3,exigence:2}},{grid:`643dc599`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTozAKoE7gMavgUi5gZC`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTozBNoD5gMypgUy1gIKXtoD`,ticks:328,entryTick:17,exitTick:321,fastest:304,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`f22fa0ef`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo0AJIENuICNvICJroI`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,965,880],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo0BMIDNtoCRuICJsII`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[985,950,835],raccord:1e3,exigence:3}},{grid:`b49f0f79`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo1APIDRtoFFsoCJqII`,ticks:340,entryTick:0,exitTick:333,fastest:333,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTo1BJoDRtoF_gKqCA`,ticks:330,entryTick:17,exitTick:323,fastest:306,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}}]},"pont-patrouille":{variants:[{grid:`7f399d54`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowALIFrgUS3gHaA27CA2bCAmbKAlbqAqYB4gIm0gU`,ticks:646,entryTick:0,exitTick:639,fastest:639,gigue:[1e3,700,365],raccord:null,exigence:0},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowBIoB5gZCJqoDtgGyA64B2gJhXjGCAlaiAl6aApYBugJW4gU`,ticks:642,entryTick:17,exitTick:635,fastest:616,gigue:[530,200,75],raccord:1e3,exigence:0}},{grid:`940366f6`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxAMIBRsIDRqIDtgUSVrIDxgQqZroCZsoCTooDLrIG`,ticks:646,entryTick:0,exitTick:639,fastest:639,gigue:[1e3,630,370],raccord:null,exigence:0},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxBIoBlgG6A9YB2gNeqgOWBSJmwgJmygJekgK2AcICNuIF`,ticks:635,entryTick:17,exitTick:629,fastest:612,gigue:[780,540,255],raccord:1e3,exigence:0}},{grid:`eb4bcab8`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyAKYFECQ1jgG6A5YBigS-AbIDpgHiAlbyAZYB-gKWAcICJvIF`,ticks:653,entryTick:0,exitTick:646,fastest:639,gigue:[650,395,195],raccord:null,exigence:0},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyBJIBhgH6BSaCA6YFIkaiA2a6Ak7iAYYB4gKmAcICJvIF`,ticks:635,entryTick:17,exitTick:629,fastest:612,gigue:[630,275,105],raccord:1e3,exigence:0}},{grid:`af27232c`,arret:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTozAMIBRrIDtgUK5gHSA27CA2bCAmbCAmbaAq4B4gIm0gU`,ticks:646,entryTick:0,exitTick:639,fastest:639,gigue:[1e3,765,370],raccord:null,exigence:0},elan:{code:`AQMYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTozBIoBhgcSNqoDvgGiA7YBwgJhdjHyAWaqAl6iApYBqgJO6gU`,ticks:642,entryTick:17,exitTick:635,fastest:616,gigue:[655,135,45],raccord:1e3,exigence:0}}]},"puits-descente":{variants:[{grid:`f3203b10`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAAigEu6gOJAaIHLooENpoIVooEPpoJ`,ticks:652,entryTick:0,exitTick:645,fastest:644,gigue:[555,295,70],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAEmgEWSFJo8QGqAhjaBS7aA06CCFa6BD6SCQ`,ticks:649,entryTick:17,exitTick:642,fastest:623,gigue:[900,505,250],raccord:1e3,exigence:0}},{grid:`638f813a`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEAejaaAigh4AJqCNIGLrIDZroHbuoDXqIJ`,ticks:652,entryTick:0,exitTick:645,fastest:646,gigue:[790,425,225],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEEogEOaEpQ8QGSAhDSBT7qA1biB3a6BD6CCQ`,ticks:647,entryTick:17,exitTick:640,fastest:625,gigue:[830,435,295],raccord:1e3,exigence:0}},{grid:`23b62775`,arret:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIAogEe8gN5ugdm6gOuAaoIXpIEdrIJ`,ticks:687,entryTick:0,exitTick:680,fastest:677,gigue:[740,630,290],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIEkgEWYEpo6QHCAgiyBWaKBU7aB3bqBEaSCQ`,ticks:680,entryTick:17,exitTick:673,fastest:655,gigue:[890,555,325],raccord:1e3,exigence:0}}]},puits:{variants:[{grid:`60c27f29`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjAAei6SBHGYAkoIigJ-ogU`,ticks:277,entryTick:0,exitTick:270,fastest:269,gigue:[770,635,635],raccord:null,exigence:4},elan:{code:`AQMObW9kdWxlOnB1aXRzOjAEigEO0gNp8AJiCLoBPpoG`,ticks:277,entryTick:17,exitTick:270,fastest:254,gigue:[1e3,985,935],raccord:1e3,exigence:2}},{grid:`671f3e57`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjEAcj6SAnAh0APqAjbSBQ`,ticks:272,entryTick:0,exitTick:265,fastest:263,gigue:[995,840,730],raccord:null,exigence:3},elan:{code:`AQMObW9kdWxlOnB1aXRzOjEEmgEW8gHRAvoBQIoCfqoF`,ticks:265,entryTick:17,exitTick:258,fastest:241,gigue:[1e3,990,960],raccord:1e3,exigence:1}},{grid:`9f0fd7fe`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjIAcj7qBHHaAm6CBg`,ticks:264,entryTick:0,exitTick:257,fastest:253,gigue:[1e3,790,625],raccord:null,exigence:4},elan:{code:`AQMObW9kdWxlOnB1aXRzOjIEogEOOBmCASRZGlBxgAGiA4YBugU`,ticks:260,entryTick:17,exitTick:253,fastest:237,gigue:[990,975,865],raccord:1e3,exigence:2}},{grid:`7544a537`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjMAYjbiA_EB2gk`,ticks:263,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,995,985],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjMEigEmIEEiWCJsxQHiAUCyCA`,ticks:259,entryTick:17,exitTick:252,fastest:235,gigue:[750,655,720],raccord:1e3,exigence:3}}]},quinconce:{variants:[{grid:`e6c257b5`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowAIoDNuIDNsIDPtoH`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,1e3,800],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowBNoCNuoDLpoDRtoH`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,930,595],raccord:1e3,exigence:5}},{grid:`26ba8d4b`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxANoDPoIFPuoDTtoI`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,760],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxBIoBlgGiBj7aA2bSCA`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`f61b9116`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToyANoDPpoGbvoERsIJ`,ticks:417,entryTick:0,exitTick:410,fastest:410,gigue:[1e3,920,795],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToyBIoBlgGSB2bCBU6iCQ`,ticks:406,entryTick:17,exitTick:399,fastest:382,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`1a10ac83`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTozANoDPvIEPpoERsII`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,845],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTozBJIBfroGPsoDZtoI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,825],raccord:1e3,exigence:3}},{grid:`c9f943da`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo0ALoDRpIFPpIFPsoH`,ticks:362,entryTick:0,exitTick:355,fastest:355,gigue:[1e3,1e3,900],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo0BIoBlgHSBWb6A1bqCA`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,930],raccord:1e3,exigence:2}},{grid:`64235541`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo1AKoDNtIDLrIDRtoH`,ticks:307,entryTick:0,exitTick:300,fastest:300,gigue:[1e3,975,625],raccord:null,exigence:4},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTo1BPICLvIDJooDPuIH`,ticks:297,entryTick:17,exitTick:290,fastest:273,gigue:[1e3,830,475],raccord:1e3,exigence:0}}]},"rebonds-doux":{variants:[{grid:`73bcad3e`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDowAOICJuICRuICJvIF`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDowBIoBJqIEJsICJvIF`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`264cfd35`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoxAOIBJsIEJuIEJooG`,ticks:285,entryTick:0,exitTick:279,fastest:279,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoxBIoBJsIEJuIEJpIG`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6588769d`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoyAOIBJoIFRuICJoIG`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDoyBIoBJuIDJoIEJqIG`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`52a8f1e4`,arret:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDozAOICJuICRuICJvIF`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnJlYm9uZHMtZG91eDozBIoBJqIEJsICJvIF`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-mur-iles":{variants:[{grid:`ed474f4e`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MABChgEw1gUylgGqAv4CMsYEMo4BwgMmigImsgNm8gIW0gI28gc`,ticks:714,entryTick:0,exitTick:707,fastest:700,gigue:[980,820,525],raccord:null,exigence:5},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MATKAtYCMoYDCq4DCq4DCp4FOk6iAz7qAg6yAzaiAg7yAi6aCA`,ticks:729,entryTick:17,exitTick:722,fastest:705,gigue:[1e3,995,815],raccord:1e3,exigence:3}},{grid:`b38aa751`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQBChgEw1gU6jgGaAq4DCt4EKn66A0a6AybKA17SAh7qAjaiCA`,ticks:746,entryTick:0,exitTick:739,fastest:732,gigue:[1e3,950,745],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQTKAvYCEoYDCq4DCq4DCp4FOlbyAlbiAy7aAz6KAxaaAzbCBw`,ticks:761,entryTick:17,exitTick:755,fastest:738,gigue:[1e3,980,865],raccord:1e3,exigence:2}},{grid:`d68ff1d5`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgDCB4YDKp4DGq4FMk7KA6YBsgRGwgIuqgMm2gc`,ticks:707,entryTick:0,exitTick:700,fastest:700,gigue:[990,945,760],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgTKAtYCMoYDCq4DCq4DGo4FUkaqAzbCAi6iAzaCAg6SAxa6CA`,ticks:729,entryTick:17,exitTick:722,fastest:705,gigue:[910,645,445],raccord:1e3,exigence:0}},{grid:`8bbe858e`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MwBChgEw1gUqngGiAqYDEsYEQn6iA1aqAzayA2baAjb6AhaqCA`,ticks:747,entryTick:0,exitTick:740,fastest:732,gigue:[1e3,965,800],raccord:null,exigence:3},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MwTKAtYCIpYDCq4DCq4DCr4FGk6KA1baAybSA06CAy6CAzbCBw`,ticks:761,entryTick:17,exitTick:754,fastest:738,gigue:[1e3,995,895],raccord:1e3,exigence:2}},{grid:`b4728776`,arret:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NACqBBgZGMICpgGaAq4B8gFuwgUuigP2AggcGhgaGRoZqgI2sgM26gk`,ticks:707,entryTick:0,exitTick:700,fastest:700,gigue:[1e3,875,505],raccord:null,exigence:5},elan:{code:`AQMZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NATqAt4CCqYDCqYDEo4DGo4B-gQ2wgOeA5IDngTaCQ`,ticks:729,entryTick:17,exitTick:722,fastest:705,gigue:[1e3,1e3,915],raccord:1e3,exigence:2}}]},"ressort-mur":{variants:[{grid:`eb6cc4f3`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAAogEUJfoK`,ticks:201,entryTick:0,exitTick:194,fastest:195,gigue:[1e3,1e3,925],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAE4gs`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`293c6639`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEAmgEUJeIL`,ticks:213,entryTick:0,exitTick:206,fastest:206,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEEsgw`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0abc9aa7`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjIAygEV2go`,ticks:198,entryTick:0,exitTick:192,fastest:195,gigue:[1e3,1e3,935],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjIE4gs`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`946a9549`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjMAogEcJaIGKCl4XtoD`,ticks:222,entryTick:0,exitTick:215,fastest:215,gigue:[995,780,695],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjME0gceygQ`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1223a2f6`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjQAqgEMHfoK`,ticks:200,entryTick:0,exitTick:193,fastest:195,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjQE4gs`,ticks:188,entryTick:17,exitTick:181,fastest:164,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-plafond":{variants:[{grid:`e5247a65`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowAMIBRooL`,ticks:209,entryTick:0,exitTick:202,fastest:202,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowBIoBhgGqCg`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`cfcfbc16`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxAJIBhgxS`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxBIoBjgH6Cg`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,890],raccord:1e3,exigence:2}},{grid:`e43aee9c`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyAMoBngUqjgMKjgEKLroF`,ticks:273,entryTick:0,exitTick:267,fastest:267,gigue:[1e3,1e3,995],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyBLoBlgUapgJRfiousgU`,ticks:265,entryTick:17,exitTick:259,fastest:246,gigue:[1e3,1e3,935],raccord:1e3,exigence:2}},{grid:`8278a5fa`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDozAJIBhgxS`,ticks:220,entryTick:0,exitTick:213,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDozBIoBhgGCCw`,ticks:209,entryTick:17,exitTick:203,fastest:186,gigue:[1e3,1e3,900],raccord:1e3,exigence:2}},{grid:`ff58a4a1`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDo0AMIBRoIDxgdK`,ticks:209,entryTick:0,exitTick:202,fastest:202,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDo0BIoBRoIDpgdK`,ticks:198,entryTick:17,exitTick:192,fastest:175,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-scie":{variants:[{grid:`e200048c`,arret:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZTowADI2ajC-ATQJnQFRlgdC`,ticks:212,entryTick:0,exitTick:205,fastest:202,gigue:[575,465,505],raccord:null,exigence:5},elan:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZTowBPICMFxtES3mBlo`,ticks:202,entryTick:17,exitTick:195,fastest:178,gigue:[905,600,455],raccord:1e3,exigence:0}},{grid:`af779341`,arret:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZToxADayAzBMdRKOB1I`,ticks:214,entryTick:0,exitTick:207,fastest:207,gigue:[595,380,265],raccord:null,exigence:0},elan:{code:`AQMVbW9kdWxlOnJlc3NvcnQtc2NpZToxBPoCOLwBMZYHSg`,ticks:206,entryTick:17,exitTick:199,fastest:180,gigue:[550,510,290],raccord:1e3,exigence:0}}]},"ressorts-escalier":{variants:[{grid:`9cb6481d`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAAkgEWsgE4SRCiAyBBIqABIUJg4gMgQdoJ`,ticks:399,entryTick:0,exitTick:392,fastest:393,gigue:[1e3,975,940],raccord:null,exigence:2},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAEqgLmAwqeBCSmDkI`,ticks:405,entryTick:17,exitTick:398,fastest:381,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ae596312`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEAwgEMDeIFMEGiAUHCBEBB8gk`,ticks:406,entryTick:0,exitTick:400,fastest:402,gigue:[1e3,1e3,910],raccord:null,exigence:2},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEEygKWBAruBDAxqg8`,ticks:442,entryTick:17,exitTick:435,fastest:414,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c6fc9037`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIAggEW8gFpkgMoQSKwARE6aOIDIEHiCQ`,ticks:400,entryTick:0,exitTick:393,fastest:393,gigue:[1e3,995,965],raccord:null,exigence:1},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIEqgLmAwqeBCSmDkI`,ticks:405,entryTick:17,exitTick:398,fastest:381,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c2790a02`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMAsgEMFZoGQaIBQeIEIEHaCQ`,ticks:403,entryTick:0,exitTick:396,fastest:402,gigue:[1e3,935,835],raccord:null,exigence:3},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMEygKWBAruBDAxqg8`,ticks:442,entryTick:17,exitTick:435,fastest:414,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ba43d2f9`,arret:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQAYkayAShpogMgQSKgASFCYIIEQeIJ`,ticks:400,entryTick:0,exitTick:393,fastest:393,gigue:[980,905,790],raccord:null,exigence:3},elan:{code:`AQMabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQEqgLmAwqeBCSmDkI`,ticks:405,entryTick:17,exitTick:398,fastest:381,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressorts-trous":{variants:[{grid:`ade9e5f0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAEqgQO4hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,910],raccord:1e3,exigence:2}},{grid:`18086399`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEA-gQe4hs`,ticks:526,entryTick:0,exitTick:519,fastest:519,gigue:[600,510,390],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEEwgQWyhs`,ticks:515,entryTick:17,exitTick:508,fastest:491,gigue:[600,555,445],raccord:1e3,exigence:0}},{grid:`8fcee7f0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjIAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjIEsgQO2hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,955,895],raccord:1e3,exigence:2}},{grid:`f1e426b0`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjMAggQmyho`,ticks:493,entryTick:0,exitTick:486,fastest:486,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjMEmgQO8hk`,ticks:482,entryTick:17,exitTick:476,fastest:459,gigue:[1e3,1e3,945],raccord:1e3,exigence:2}}]},"saut-long":{variants:[{grid:`6d93ca6a`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowAOoHNvoG`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowBNIGRqoH`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`24b0d8be`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxAOoHbpoH`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxBJIHXqoH`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`f9e395cf`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyAOIHfuoH`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,980],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyBJIHhgHaBw`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`3b4e8b39`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzozAPoGXsIH`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzozBMoGTqoH`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}},{grid:`448dccfe`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo0AOoHbpoH`,ticks:253,entryTick:0,exitTick:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo0BJIHVrIH`,ticks:242,entryTick:17,exitTick:235,fastest:218,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`db27e451`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo1AJIGRsII`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzo1BMIFRroI`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},"saut-plafond":{variants:[{grid:`fb40d9d4`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDowAKoE9gUqxgdC`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDowBNoD3gUqxgda`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,895],raccord:1e3,exigence:2}},{grid:`da9f51ee`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoxAIIFxgYqvgdS`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoxBKoE5gYargda`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`54a30d00`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoyAKIEPsoFPuoH`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,900],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDoyBIoDRpoGPtoH`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,950,770],raccord:1e3,exigence:3}},{grid:`884e5a34`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDozAKoE9gUqxgdC`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDozBNoD1gUyxgda`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,840],raccord:1e3,exigence:3}},{grid:`75936bd0`,arret:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDo0AIIFjgYq_gdK`,ticks:318,entryTick:0,exitTick:311,fastest:311,gigue:[1e3,1e3,905],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnNhdXQtcGxhZm9uZDo0BKoEjgYy9gdS`,ticks:308,entryTick:17,exitTick:301,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-ronde":{variants:[{grid:`10b2c80e`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MACCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MASyCS4KLqIE`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`78ae81a0`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQCCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQSyCS7SBA`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7e67a8c5`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgCCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgSyCS4KLqIE`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`816f2382`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MwCCCibqBA`,ticks:241,entryTick:0,exitTick:234,fastest:234,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MwSyCS7SBA`,ticks:229,entryTick:17,exitTick:222,fastest:205,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-sol":{variants:[{grid:`9fb722ea`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAAggaWBDLGB0I`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAEogWWBDq-B1I`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6381d1a2`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEAogXmAzLWCEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEEygTmAyLmCEo`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,920],raccord:1e3,exigence:2}},{grid:`86754e26`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIAugU-sgIwMSI-ogI41gVi`,ticks:300,entryTick:0,exitTick:293,fastest:290,gigue:[635,585,435],raccord:null,exigence:0},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIE2gOmAwreAhpGwgc`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[740,595,320],raccord:1e3,exigence:0}},{grid:`da14bc56`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjMAkgTWAiKeAxreBzo`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,945],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjMEwgPWAhqmAyLGB0o`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`aec748a4`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjQAogXmAzLWCEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjQEygTeAzLOCFo`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`834bf66e`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjUAogXmAzLWCEI`,ticks:296,entryTick:0,exitTick:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjUEygT2AxLmCEo`,ticks:286,entryTick:17,exitTick:279,fastest:262,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},"scies-jumelles":{variants:[{grid:`691777e5`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAAogKmBSL-B2o`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,860],raccord:null,exigence:2},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAE6gHOAdoDpghC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,935],raccord:1e3,exigence:2}},{grid:`7cbeccc5`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEAogKGBjKWB2I`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEE-gKWAeIDxgdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d7c8087d`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIAggO2AeIDjgGqBw`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,975,785],raccord:null,exigence:3},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIEmgLGAeID9gdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,930],raccord:1e3,exigence:2}},{grid:`f53a9ae7`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjMAqgKeBSL-B2o`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjME4gHWAdoDpghC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6d934606`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjQA0gOGAcoDfrIH`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[905,535,325],raccord:null,exigence:0},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjQEogLOAdID9gdC`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,905,880],raccord:1e3,exigence:2}},{grid:`a13cdb87`,arret:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjUAogKGBjKWB2I`,ticks:264,entryTick:0,exitTick:257,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjUEigOGAeIDhgGCBw`,ticks:253,entryTick:17,exitTick:246,fastest:229,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}}]},toboggan:{variants:[{grid:`f21c0c1f`,arret:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjAAugQu6gRGigV--gc`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,940,530],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjAE0gM-6gRGigWWAeIH`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,880,705],raccord:1e3,exigence:4}},{grid:`62479773`,arret:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjEAqgQ-8gQ-ggVOsgg`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,925,635],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjEE4gM24gRG-gSWAfIH`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,915,680],raccord:1e3,exigence:4}},{grid:`719561ed`,arret:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjIAmgRG-gQ-8gRWugg`,ticks:384,entryTick:0,exitTick:377,fastest:377,gigue:[1e3,925,645],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOnRvYm9nZ2FuOjIE2gM-4gRGigVGsgg`,ticks:373,entryTick:17,exitTick:366,fastest:349,gigue:[1e3,865,575],raccord:1e3,exigence:5}}]},tremplin:{variants:[{grid:`6eca0fbd`,arret:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjAA2gMm4gEg7gUaJuoBRZoI`,ticks:363,entryTick:0,exitTick:357,fastest:356,gigue:[535,425,315],raccord:null,exigence:0},elan:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjAEygO2AeoGrgHyCA`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`2e6c3461`,arret:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjEAsgMu-gE02gUmggIkwgg`,ticks:363,entryTick:0,exitTick:356,fastest:355,gigue:[700,390,280],raccord:null,exigence:0},elan:{code:`AQMRbW9kdWxlOnRyZW1wbGluOjEEogOmCCKmAfoI`,ticks:351,entryTick:17,exitTick:345,fastest:328,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"tunnel-scies":{variants:[{grid:`645a66bb`,arret:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczowANoBFvoCLuoCrgH6ApYDMi76AkbaAp4EwgKmAQo-JCUKHkQKHmQJXQpuVQo-Cr4BIoYFUg`,ticks:686,entryTick:0,exitTick:679,fastest:678,gigue:[1e3,950,780],raccord:null,exigence:3},elan:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczowBOICdpoD1gNKhgHSAhaKA2aCA-YDCh7CAqYBCl4lCn4KHmQJHWYKHkQlCl4KXiUJHSTmBEI`,ticks:669,entryTick:17,exitTick:662,fastest:645,gigue:[1e3,995,950],raccord:1e3,exigence:1}},{grid:`9033a3f0`,arret:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczoxAHpOkgOWAaIDxgMiRpID1gMazgMS1gMivgESPiomXBJWCh5kCl4KNhwlCmYSRjEKtgGiBA`,ticks:670,entryTick:0,exitTick:663,fastest:655,gigue:[1e3,895,650],raccord:null,exigence:4},elan:{code:`AQMVbW9kdWxlOnR1bm5lbC1zY2llczoxBOoCbpoD5gQi5gMixgMavgcStgEKVgoubApeCg50Cl4KLiQ1ClYKRikaxgGSBA`,ticks:659,entryTick:17,exitTick:652,fastest:631,gigue:[1e3,900,680],raccord:1e3,exigence:4}}]},tunnel:{variants:[{grid:`54d03cf7`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDowAKoEZtoD5gVS`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,990,765],raccord:null,exigence:3},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDowBIoBZrID1gIKLqIG`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,945],raccord:1e3,exigence:2}},{grid:`aafc0da5`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoxAJoEboID5gIipgZK`,ticks:285,entryTick:0,exitTick:279,fastest:279,gigue:[1e3,960,825],raccord:null,exigence:3},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoxBLIBbvoCRroDbqoH`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[1e3,900,665],raccord:1e3,exigence:4}},{grid:`47953f7c`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoyAKIEbuoDxgMSbqIH`,ticks:329,entryTick:0,exitTick:322,fastest:322,gigue:[1e3,1e3,655],raccord:null,exigence:4},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoyBJoBfvICRrIDfvoC1gZK`,ticks:319,entryTick:17,exitTick:312,fastest:295,gigue:[965,860,675],raccord:1e3,exigence:4}},{grid:`1e7a7b4b`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDozAKIEfvIC3gIipgZK`,ticks:285,entryTick:0,exitTick:279,fastest:279,gigue:[1e3,955,905],raccord:null,exigence:2},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDozBIoBZqoDPsoDbqIH`,ticks:275,entryTick:17,exitTick:268,fastest:251,gigue:[1e3,930,620],raccord:1e3,exigence:4}},{grid:`c764abed`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDo0ANIB_gIq1gIy5gZC`,ticks:242,entryTick:0,exitTick:235,fastest:235,gigue:[1e3,1e3,895],raccord:null,exigence:2},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDo0BJIBbpIDPooDdoIF`,ticks:231,entryTick:17,exitTick:224,fastest:207,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]}}},Oe=[`mural`,`precision`,`vertical`,`scie`,`friable`,`ressort`,`respiration`],K=[`plafond`,`fosse`,`sol-friable`,`patrouille`,`garde`,`ressort`,`denivele`];var q=class extends Error{constructor(e){super(e),this.name=`ModuleError`}};let ke=/* @__PURE__ */ new Set([`id`,`intention`,`etiquettes`,`famille`,`enchainement`,`elan`,`mutateurs`,`format`,`paliers`,`repeter`,`variante`]);function Ae(e){let t=/^(\d+)(?:-(\d+))?$/.exec(e);if(!t)return null;let n=Number(t[1]),r=t[2]===void 0?n:Number(t[2]);return n<=r?[n,r]:null}function je(e,t,n,r){let i=e[1];K.includes(i)||r(`zone « ${e[1]} » : mutateur inconnu (${K.join(`, `)})`);let a=e=>{let n=e===void 0?null:Ae(e);return(!n||n[1]>=t)&&r(`zone ${i} : colonnes « ${e} » hors du gabarit`),n},o=e=>{let t=e===void 0?null:Ae(e);return(!t||t[1]>=n)&&r(`zone ${i} : rangées « ${e} » hors du gabarit`),t},s=(e,t,n=``)=>({name:i,c0:e[0],c1:e[1],r0:t[0],r1:t[1],extra:n});switch(i){case`plafond`:case`fosse`:case`sol-friable`:case`ressort`:return e.length!==4&&r(`« zone ${i} <colonnes> <rangée> » attendu`),s(a(e[2]),o(e[3]));case`garde`:return(e.length!==5||e[4].length!==1||!`<>^v`.includes(e[4]))&&r(`« zone garde <colonnes> <rangées> <pic : < > ^ v> » attendu`),s(a(e[2]),o(e[3]),e[4]);case`denivele`:{e.length!==3&&r(`« zone denivele <colonnes> » attendu`);let i=a(e[2]);return i[1]!==t-1&&r(`zone denivele : elle va jusqu'à la dernière colonne (la sortie)`),s(i,[0,n-1])}case`patrouille`:return e.length<7&&r(`« zone patrouille <rayon> <cycle> <mode> <c,r> <c,r>… » attendu`),s([0,t-1],[0,n-1],e.slice(2).join(` `))}}let Me=/^[#.^v<>oOx*]+$/;function Ne(e){let t=e.replace(/\r/g,``).split(`
`),n=0,r={};for(;n<t.length;n++){let e=t[n].trim();if(e===``||e.startsWith(`//`))continue;if(e===`grille:`)break;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(!i||!ke.has(i[1]))throw new q(`Ligne ${n+1} : « clé: valeur » attendu (${[...ke].join(`, `)}, puis « grille: »)`);(r[i[1]]??=[]).push(i[2].trim())}if(n>=t.length)throw new q(`« grille: » manquant`);let i=e=>{let t=r[e];if(!t||t.length!==1||t[0]===``)throw new q(`« ${e}: » attendu une fois`);return t[0]},a=i(`id`);if(!/^[a-z0-9-]{1,24}$/.test(a))throw new q(`id « ${a} » invalide (minuscules, chiffres, tirets, 24 au plus)`);let o=e=>`Morceau « ${a} » : ${e}`,s=i(`intention`),c=i(`etiquettes`).split(/\s+/);for(let e of c)if(!Oe.includes(e))throw new q(o(`étiquette « ${e} » inconnue (${Oe.join(`, `)})`));if(new Set(c).size!==c.length)throw new q(o(`étiquette en double`));if(i(`format`)!==`3`)throw new q(o(`format ${i(`format`)} : seul le format 3 (paliers posés, famille et mutateurs, lot 7) est lu`));let l=i(`famille`);if(!/^[a-z0-9-]{1,24}$/.test(l))throw new q(o(`famille « ${l} » invalide (minuscules, chiffres, tirets)`));let u=(e,t)=>{let n=r[e];if(!n)return!1;if(n.length!==1||n[0]!==t)throw new q(o(`« ${e}: ${t} » attendu (ou rien)`));return!0},d=u(`enchainement`,`long`),f=u(`elan`,`oui`),p=(r.mutateurs??[]).flatMap(e=>e.split(/\s+/)).filter(Boolean);for(let e of p)if(!K.includes(e))throw new q(o(`mutateur « ${e} » inconnu (${K.join(`, `)})`));if(new Set(p).size!==p.length)throw new q(o(`mutateur en double`));let m=/^(\d+)\s+(\d+)$/.exec(i(`paliers`));if(!m)throw new q(o(`« paliers: <rangée du sol à l'entrée> <rangée du sol à la sortie> » attendu`));n++;let h=[];for(;n<t.length&&t[n].trim()!==``;n++)h.push(t[n].trim());let _=t.slice(n).map(e=>e.trim()).filter(e=>e!==``&&!e.startsWith(`//`)),v=_.filter(e=>!e.startsWith(`zone `));if(h.length===0)throw new q(o(`grille vide`));let y=h[0].length;h.forEach((e,t)=>{if(e.length!==y)throw new q(o(`rangée ${t} : ${e.length} colonnes au lieu de ${y}`));if(!Me.test(e))throw new q(o(`rangée ${t} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`))});let b=Number(m[1]),x=Number(m[2]);if(b>=h.length||x>=h.length)throw new q(o(`rangée de palier hors de la grille`));if(b<4||x<4)throw new q(o(`rangée de palier sous la 4e : moins de 4 rangées libres au-dessus`));let S=[],C=(r.repeter??[]).map(e=>{let t=/^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(e);if(!t)throw new q(o(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${e} »)`));let n={param:t[1],axis:t[2],from:Number(t[3]),to:Number(t[4])},r=n.axis===`colonnes`?y:h.length;if(n.from>n.to||n.to>=r)throw new q(o(`plage ${n.from}-${n.to} hors du gabarit`));return S.includes(n.param)||S.push(n.param),n});for(let e of C)for(let t of C)if(e!==t&&e.axis===t.axis&&e.from<=t.to&&t.from<=e.to)throw new q(o(`les plages ${e.from}-${e.to} et ${t.from}-${t.to} se chevauchent`));for(let e of _)for(let t of e.matchAll(/\{([a-z][a-z0-9]*)\}/g))S.includes(t[1])||S.push(t[1]);let w=e=>{throw new q(o(e))},T=_.filter(e=>e.startsWith(`zone `)).map(e=>je(e.split(/\s+/),y,h.length,w));for(let e of p)T.some(t=>t.name===e)||w(`mutateur « ${e} » sans zone`);for(let e of T)p.includes(e.name)||w(`zone ${e.name} : mutateur absent de « mutateurs: »`);for(let e of[b,x])if(C.some(t=>t.axis===`rangees`&&e>=t.from&&e<=t.to))throw new q(o(`une rangée de palier ne se répète pas`));let E=[],D=(r.variante??[]).map((e,t)=>{let n={},r=[];E.push(r);for(let i of e.split(/\s+/).filter(Boolean)){if(i.startsWith(`+`)){let e=/^\+([a-z-]+)(?::(-?[a-z0-9]+))?$/.exec(i);(!e||!p.includes(e[1]))&&w(`variante ${t} : mutateur « ${i} » non accepté (${p.join(`, `)||`aucun`})`);let n=e[1],a=e[2]??``;(n===`plafond`?a===``||a===`nu`||a===`pics`:n===`denivele`?/^-?[1-9]\d?$/.test(a):n===`patrouille`?a===``||/^[1-9]\d{0,4}$/.test(a):a===``)||w(`variante ${t} : argument « ${a} » de ${n} invalide`),r.some(e=>e.name===n)&&w(`variante ${t} : ${n} deux fois`),r.push({name:n,arg:a});continue}let e=/^([a-z][a-z0-9]*)=(\d+)$/.exec(i);if(!e)throw new q(o(`variante ${t} : « nom=valeur » attendu (« ${i} »)`));if(!S.includes(e[1]))throw new q(o(`variante ${t} : paramètre « ${e[1]} » inconnu`));let a=Number(e[2]),s=C.some(t=>t.param===e[1])?40:g;if(a>s)throw new q(o(`variante ${t} : ${e[1]} = ${a} (au plus ${s})`));n[e[1]]=a}for(let e of S)if(n[e]===void 0)throw new q(o(`variante ${t} : « ${e} » manque`));return r.length>2&&w(`variante ${t} : au plus 2 mutateurs`),n});if(D.length===0)throw new q(o(`au moins une « variante: » (même sans paramètre)`));return D.length>6&&w(`${D.length} variantes (au plus 6)`),new Set(D.map((e,t)=>JSON.stringify([e,E[t]]))).size!==D.length&&w(`deux variantes identiques`),{id:a,intention:s,tags:c,family:l,long:d,elan:f,mutators:p,zones:T,mutations:E,entryRow:b,exitRow:x,repeats:C,params:S,variants:D,grid:h,annex:v,text:e}}function Pe(e,t){let n=e.grid.map(e=>e.split(``)),r=[...e.annex],i=null,a=t=>{throw new q(`Morceau « ${e.id} » : ${t}`)},o=(e,t)=>n[t][e],s=(e,t,r)=>{n[t][e]=r},c=0;for(let l of t){let t=e.zones.filter(e=>e.name===l.name);for(let e of t){let t=`${l.name} (colonnes ${e.c0}-${e.c1})`;switch(l.name){case`plafond`:for(let n=e.c0;n<=e.c1;n++)for(let r=0;r<=e.r0;r++)o(n,r)!==`.`&&o(n,r)!==`#`&&a(`${t} : tuile (${n}, ${r}) « ${o(n,r)} » sous le plafond`),s(n,r,r===e.r0&&l.arg===`pics`?`v`:`#`);break;case`fosse`:{let r=[];for(let t=e.c0;t<=e.c1;t++)r.push(o(t,e.r0)===`^`);if(r.every(Boolean))for(let t=e.c0;t<=e.c1;t++)for(let r=e.r0;r<n.length;r++)s(t,r,`.`);else for(let r=e.c0;r<=e.c1;r++){for(let i=e.r0;i<n.length;i++)o(r,i)!==`.`&&a(`${t} : ni fond de pics ni fond vide (tuile (${r}, ${i}))`);s(r,e.r0,`^`);for(let t=e.r0+1;t<n.length;t++)s(r,t,`#`)}break}case`sol-friable`:case`ressort`:for(let n=e.c0;n<=e.c1;n++)o(n,e.r0)!==`#`&&a(`${t} : tuile (${n}, ${e.r0}) « ${o(n,e.r0)} » au lieu d'un bloc`),s(n,e.r0,l.name===`ressort`?`*`:`x`);break;case`garde`:for(let n=e.c0;n<=e.c1;n++)for(let r=e.r0;r<=e.r1;r++)o(n,r)!==`.`&&a(`${t} : tuile (${n}, ${r}) occupée`),s(n,r,e.extra);break;case`patrouille`:{let t=e.extra.split(` `);l.arg&&(t[1]=l.arg),r.push(`scie mutee${c++||``} ${t.join(` `)}`);break}case`denivele`:i={from:e.c0,k:Number(l.arg)};for(let n of r)for(let r of n.split(/\s+/).slice(5))Number(/^(\d+)/.exec(r)?.[1]??-1)>=e.c0&&a(`${t} : une scie y passe`)}}}return{grid:n.map(e=>e.join(``)),annex:r,denivele:i}}function Fe(e,t,n){let r=[],i=Array(e).fill(-1),a=Array(e).fill(-1);for(let o=0;o<e;){let e=t.find(e=>e.from===o),s=e?e.to:o,c=e?n[e.param]:1;for(let e=0;e<c;e++)for(let t=o;t<=s;t++)e===0&&(i[t]=r.length),a[t]=r.length,r.push(t);o=s+1}return{src:r,first:i,last:a}}function J(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t.toString(16).padStart(8,`0`)}let Y=(e,t)=>e<t?`.`:`#`;function Ie(e,t,n={}){let r=e.variants[t];if(!r)throw new q(`Morceau « ${e.id} » : pas de variante ${t} (0 à ${e.variants.length-1})`);let i=n.lancement??0;if(!Number.isInteger(i)||i<0||i>40)throw new q(`lancement : de 0 à 40 colonnes`);let a=n=>`Morceau « ${e.id} », variante ${t} : ${n}`,o=e.mutations[t]??[],s;try{s=Pe(e,o)}catch(e){throw e instanceof q?new q(a(e.message)):e}let c=Fe(s.grid[0].length,e.repeats.filter(e=>e.axis===`colonnes`),r),l=Fe(s.grid.length,e.repeats.filter(e=>e.axis===`rangees`),r),u=c.src.length;if(u<1)throw new q(a(`grille vide`));let d=l.first[e.entryRow],f=l.first[e.exitRow],p=i+1+2,m=p+u+2,h=i>0?0:1,g=l.src.map(e=>c.src.map(t=>s.grid[e][t]));if(s.denivele){let{from:e,k:t}=s.denivele,n=c.src.map(t=>t>=e);if(t>0){let e=g[g.length-1];for(let n=0;n<t;n++)g.push([...e])}else if(f+t<4)throw new q(a(`dénivelé ${t} : moins de 4 rangées au-dessus de la sortie`));let r=g.length;for(let e=0;e<n.length;e++){if(!n[e])continue;let i=g.map(t=>t[e]);for(let n=0;n<r;n++)g[n][e]=t>0?n>=t?i[n-t]:`.`:n-t<r?i[n-t]:i[r-1]}f+=t}let _=g.map(e=>e.join(``)),v=_.length;if(v>30)throw new q(a(`${v} rangées (au plus 30)`));let b=_.map((e,t)=>{let n=Y(t,d).repeat(p),r=t===d-1?n.slice(0,h)+`S`+n.slice(h+1):n,i=Y(t,f).repeat(3)+(t===f-1?`F`:Y(t,f));return r+e+i}),x=[`section ${e.id} ${p}-${p+u-1}`];for(let e of s.annex){let t=e.replace(/\{([a-z][a-z0-9]*)\}/g,(e,t)=>String(r[t])).split(/\s+/);if(t[0]!==`scie`)throw new q(a(`bloc annexe : seules les scies sont permises (« ${t[0]} »)`));x.push(t.map((e,t)=>{let n=t>=5?/^(\d+)('?),(\d+)('?)$/.exec(e):null;if(!n)return e;let r=Number(n[1]),i=Number(n[3]),o=(n[2]?c.last:c.first)[r],s=(n[4]?l.last:l.first)[i];if(o===void 0||s===void 0||o<0||s<0)throw new q(a(`point ${e} hors de la grille ou retiré par la variante`));return`${o+p},${s}`}).join(` `))}let S=b.join(`
`)+`

`+x.join(`
`)+`
`,C;try{C=T(S)}catch(e){throw e instanceof y?new q(a(e.message)):e}let w={id:e.id,variant:t,values:r,mutations:o,levelId:`module:${e.id}:${t}`,level:C,ascii:S,hash:J(S),lead:p,width:u,height:v,entryRow:d,exitRow:f,palierIn:{col0:p-2,col1:p-1,row:d},palierOut:{col0:p+u,col1:p+u+2-1,row:f},exitCol:m},E=Le(w);if(E.length>0)throw new q(a(E.join(` ; `)));return w}function Le(e){let t=[],n=e.level,r=f,i=(e,t)=>n.tiles[t*n.width+e];for(let[a,o]of[[`entrée`,e.palierIn],[`sortie`,e.palierOut]]){o.row<4&&t.push(`palier d'${a} : moins de 4 rangées au-dessus`);for(let e=o.col0;e<=o.col1;e++)for(let r=0;r<n.height;r++){let n=r<o.row?0:1;i(e,r)!==n&&t.push(`palier d'${a} : tuile (${e}, ${r}) ${n===1?`vide`:`occupée`}`)}let e={x:o.col0*r,y:(o.row-4)*r,w:(o.col1-o.col0+1)*r,h:4*r};for(let r of n.saws){let n=r.cycle===0?1:r.cycle;for(let i=0;i<n;i++){let n=D(r,i);if(oe(n.x,n.y,r.radius,e)){t.push(`palier d'${a} : la scie ${r.id} y passe`);break}}}}return m(i(e.lead,e.entryRow-1))&&t.push(`première colonne du morceau pleine au ras du sol : on n'y entre pas en courant`),t}let Re=Ee.map(Ne);function ze(e){let t=Re.find(t=>t.id===e);if(!t)throw new q(`Morceau « ${e} » inconnu`);return t}function Be(e,t,n={}){return Ie(ze(e),t,n)}Array.from({length:25},(e,t)=>7+15*t);function Ve(e){return O(e.x+p(M,2))}function He(e){return e.ground===1&&e.vx===F.runSpeed&&e.vy===0&&e.air===0&&e.wallSide===0&&e.wallAir===255&&e.slide===0&&e.buffer===0&&e.held===0&&e.jumping===0&&e.lock===0&&e.lockDir===0}function Ue(e,t){return De.jumpSimVersion===3?De.modules[e]?.variants[t]??null:null}function We(e){return!e||!e.arret||!e.elan||e.arret.exigence===0||e.elan.exigence===0?0:Math.max(e.arret.exigence,e.elan.exigence)}let Ge=n(2026,10,16);function Ke(e){return e-Ge+1}function qe(e){return`jour-${a(e)}-g4`}let Je=3e3,Ye=4800,X=3600,Z=3360,Xe=3840,Ze={gold:110,silver:130,bronze:160};function Qe(e){return Number.parseInt(J(`repos2527:${e}`),16)%7}function $e(e,t){return((e-(4*t%7+7)%7)%7+7)%7<4}function et(e,t){return!$e(Qe(e),t)}let tt=(e,t)=>p(e*t+99,100);function nt(e){return{author:e,gold:tt(e,Ze.gold),silver:tt(e,Ze.silver),bronze:tt(e,Ze.bronze)}}let rt=null;function it(){return rt||(rt=Re.map(e=>e.variants.flatMap((t,n)=>{let r=Ue(e.id,n),i=We(r);if(!r?.arret||!r.elan||i<1)return[];let a=Be(e.id,n),o=e=>e.exitTick-e.entryTick;return[{id:e.id,variant:n,tags:e.tags,family:e.family,long:e.long,exigence:i,arret:o(r.arret),elan:o(r.elan),height:a.height,width:a.width,entryRow:a.entryRow,exitRow:a.exitRow}]})).filter(e=>e.length>0),rt)}let Q=(e,t)=>e.tags.includes(t),at=e=>e.entry===`arret`?e.choice.arret:e.choice.elan;function ot(e){let t=[],n=0;e.forEach((r,i)=>{i>0&&(n=t[i-1]+e[i-1].choice.exitRow-r.choice.entryRow),t.push(n)});let r=0,i=0;return e.forEach((e,n)=>{(n===0||t[n]<r)&&(r=t[n]),(n===0||t[n]+e.choice.height>i)&&(i=t[n]+e.choice.height)}),{tops:t.map(e=>e-r+1),height:i-r+1}}let $=(e,t)=>p(e*1e3,t);function st(e,t){let n=it().filter(t=>!et(t[0].id,e)),r=[],i=/* @__PURE__ */ new Set,a=/* @__PURE__ */ new Set,o=0;for(;;){if(r.length>=13)return`trop de morceaux`;let e=r.length===0?`arret`:`elan`,s=$(o,X),c=r.reduce((e,t)=>e+t.choice.exigence,0)*100,l=s<600?0:p((p(492*o,720)-c)*100,100),u=100+p(260*(s<1e3?s:1e3),1e3)+l,d=r.length>=2&&r.slice(-2).every(e=>Q(e.choice,`precision`)),f=!r.some(e=>Q(e.choice,`mural`)),m=!r.some(e=>Q(e.choice,`scie`)),h=!r.some(e=>Q(e.choice,`respiration`)),g=!r.some(e=>e.choice.exigence>=4),_=r.filter(e=>e.choice.long).length,v=_<1&&s>=300,y=(e,t)=>{let n=o+p(t,2);return n>=p(Xe*350,1e3)&&n<=p(Z*650,1e3)&&Q(e,`respiration`)},b=h&&o+360>p(Z*650,1e3),x=f&&s>=550,S=m&&s>=550,C=g&&s>=667,w=[];for(let s of n){let n=s[0].id;if(i.has(n)||a.has(s[0].family))continue;let c=s[0].tags;if((s[0].long?_>=2:v&&!b)||d&&c.includes(`precision`)||c.includes(`respiration`)&&!h||b&&!c.includes(`respiration`)||(x||S)&&!(x&&c.includes(`mural`)||S&&c.includes(`scie`)))continue;let l=s.filter(t=>{let n={choice:t,entry:e},i=at(n)+0;if(Q(t,`respiration`)&&!y(t,i)||C&&t.exigence<4)return!1;let a=o+i;if(a>Xe)return!1;if(a>=Z){let e=[...r.map(e=>e.choice),t];if(!e.some(e=>Q(e,`mural`))||!e.some(e=>Q(e,`scie`))||!e.some(e=>Q(e,`respiration`))||!e.some(e=>e.exigence>=4)||e.length<6||e.filter(e=>e.long).length<1)return!1}return ot([...r,n]).height<=56});if(l.length===0)continue;let p=[],g=1/0;for(let e of l){let t=Math.abs(e.exigence*100-u);t<g?(g=t,p=[e]):t===g&&p.push(e)}let T=p.length===1?p[0]:t.pick(p),E=g<=50?8:g<=100?5:g<=200?2:1;(f&&Q(T,`mural`)||m&&Q(T,`scie`))&&(E*=2),Q(T,`respiration`)&&(E*=4),w.push({pick:{choice:T,entry:e},weight:E})}if(w.length===0){let e=[b&&`respiration`,v&&!b&&`long`,x&&`mural`,S&&`scie`,C&&`pointe`].filter(Boolean);return`impasse au morceau ${r.length+1}${e.length?` (imposés : ${e.join(`, `)})`:``}`}let T=0;for(let e of w)T+=e.weight;let E=t.int(T),D=w[0];for(let e of w){if(E<e.weight){D=e;break}E-=e.weight}if(r.push(D.pick),i.add(D.pick.choice.id),a.add(D.pick.choice.family),o+=at(D.pick)+(r.length,0),o>=Z)return r}}function ct(e){let t=it().flat(),n=e.map((e,n)=>{let r=t.find(t=>t.id===e.id&&t.variant===e.variant);if(!r)throw RangeError(`Morceau « ${e.id} », variante ${e.variant} : pas de solution utilisable`);return{choice:r,entry:n===0?`arret`:`elan`}});if(n.length===0)throw RangeError(`Assemblage vide`);let{tops:r,height:i}=ot(n),a=1+n.reduce((e,t)=>e+t.choice.width,0)+(n.length+1)*2+1,o=[];for(let e=0;e<i;e++)o.push(Array(a).fill(`#`));let s=[],c=[],l=[],u=3;n.forEach((e,t)=>{let n=Be(e.choice.id,e.choice.variant),[a,l=``]=n.ascii.split(`

`),d=a.split(`
`).map(e=>e.slice(n.lead,n.lead+n.width)),f=r[t];for(let e=0;e<d.length;e++)for(let t=0;t<n.width;t++)o[f+e][u+t]=d[e][t];let p=d[d.length-1];for(let e=0;e<n.width;e++)if(p[e]!==`#`)for(let t=f+d.length;t<i;t++)o[t][u+e]=`.`;s.push(`section ${e.choice.id} ${u}-${u+n.width-1}`);for(let t of l.split(`
`)){let r=t.trim().split(/\s+/);r[0]===`scie`&&s.push(r.map((t,r)=>{if(r===1)return`${e.choice.id}/${t}`;let i=r>=5?/^(\d+),(\d+)$/.exec(t):null;return i?`${Number(i[1])-n.lead+u},${Number(i[2])+f}`:t}).join(` `))}c.push({id:e.choice.id,variant:e.choice.variant,entry:e.entry,tags:e.choice.tags,family:e.choice.family,long:e.choice.long,exigence:e.choice.exigence,solutionTicks:at(e),col0:u,col1:u+n.width-1,top:f,entryRow:f+n.entryRow,exitRow:f+n.exitRow,start:0,end:0}),u+=n.width+2});for(let e=0;e<=n.length;e++){let t=c[e-1],r=c[e],a=r?r.entryRow:t.exitRow,s=Math.min(t?t.top:i,r?r.top:i),u=r?r.col0-2:t.col1+1,d=e===0?u-1:u,f=e===n.length?u+2+1:u+2;for(let e=d;e<f;e++)for(let t=s;t<a;t++)o[t][e]=`.`;l.push({col0:u,col1:u+2-1,row:a}),o[a-1][u]=e===0?`S`:e===n.length?`.`:`C`,e===n.length&&(o[a-1][u+2]=`F`)}let d=o.map(e=>e.join(``)).join(`
`)+`

`+s.join(`
`)+`
`;return{level:T(d),ascii:d,pieces:c,paliers:l}}function lt(e){let t=e.level,n=(e,n)=>U(e,n,t,F),r=[],i=[],a=H(t);for(let t=0;t<e.pieces.length;t++){let o=e.pieces[t],s=Ue(o.id,o.variant)?.[o.entry];if(!s)return`${o.id}:${o.variant} sans solution`;let c=_e(be(s.code).runs),l=t===e.pieces.length-1,u=l?-1:e.pieces[t+1].col0;i.push(r.length);let d=!1,f=c.length+64;for(let e=t===0?0:s.entryTick;e<f&&!d;e++){let i=e<c.length?c[e]:2;if(a=n(a,i),r.push(i),a.status===2)return`${o.id}:${o.variant} meurt (morceau ${t+1})`;if(a.status===3){if(!l)return`${o.id}:${o.variant} touche l'arrivée (morceau ${t+1})`;d=!0}else if(!l&&Ve(a.player)>=u){if(!He(a.player))return`${o.id}:${o.variant} sort hors de la course propre (morceau ${t+1})`;d=!0}}if(!d)return`${o.id}:${o.variant} n'aboutit pas (morceau ${t+1})`}return{inputs:r,starts:i}}function ut(e,t){let n=0,r=[[0,0],[0,0],[0,0]];for(let i of e){n+=i.exigence;let e=p(i.start+i.end,2),a=e*3<t?0:e*3<t*2?1:2;r[a][0]+=i.exigence*(i.end-i.start),r[a][1]+=i.end-i.start}let i=e=>e[1]===0?0:p(e[0]*10,e[1]);return{sum:n,rate:t>0?p(n*10*60*120,t):0,thirds:[i(r[0]),i(r[1]),i(r[2])]}}function dt(e){let t=[],{pieces:n,authorTicks:r}=e;(r<Je||r>Ye)&&t.push(`temps de l'auteur ${r} pas hors de [${Je}, ${Ye}]`),(n.length<6||n.length>13)&&t.push(`${n.length} morceaux (de 6 à 13)`),e.level.height>56&&t.push(`hauteur ${e.level.height} (au plus 56)`),new Set(n.map(e=>e.id)).size!==n.length&&t.push(`morceau en double`),new Set(n.map(e=>e.family)).size!==n.length&&t.push(`famille en double`);let i=n.filter(e=>e.long).length;(i<1||i>2)&&t.push(`${i} enchaînements longs (de 1 à 2)`),e.longestRun>240&&t.push(`course au sol sans saut de ${e.longestRun} pas (au plus 240)`),n.some(e=>e.tags.includes(`mural`))||t.push(`aucun morceau mural`),n.some(e=>e.tags.includes(`scie`))||t.push(`aucun morceau scie`);let a=0;for(let e of n)a=e.tags.includes(`precision`)?a+1:0,a>2&&t.push(`plus de 2 morceaux precision d'affilée`);let o=n.filter(e=>e.tags.includes(`respiration`));o.length!==1&&t.push(`${o.length} morceaux respiration (un seul, au milieu)`);for(let e of o){let n=$(e.start+e.end,2*r);(n<350||n>650)&&t.push(`respiration à ${n} ‰ (entre 350 et 650)`)}(n[0]?.entry!==`arret`||n.slice(1).some(e=>e.entry!==`elan`))&&t.push(`entrées : le premier à l'arrêt, les autres en élan`),n.some(e=>e.exigence>=4)||t.push(`aucun morceau d'exigence 4 ou plus`);let s=e.exigence;(s.rate<445||s.rate>540)&&t.push(`exigence ${s.rate} hors de [445, 540]`),s.thirds[2]<s.thirds[0]&&t.push(`le dernier tiers (${s.thirds[2]}) est moins exigeant que le premier (${s.thirds[0]})`),s.thirds[2]<s.thirds[1]&&t.push(`le dernier tiers (${s.thirds[2]}) est moins exigeant que le deuxième (${s.thirds[1]})`);let c=e.palierTicks.reduce((e,t)=>e+t,0);return c*1e3>=60*r&&t.push(`course à vide sur les paliers ${$(c,r)} ‰ (moins de 60 ‰)`),t}function ft(e,t,n){let r=t.slice(1,-1),i=r.map(()=>0),a=H(e);for(let t of n){if(a=U(a,t,e,F),a.status===2)break;if(a.player.ground===1&&!(t&4)){let e=Ve(a.player);for(let t=0;t<r.length;t++)e>=r[t].col0&&e<=r[t].col1&&i[t]++}if(a.status===3)break}return i}function pt(e,t){let n=H(e),r=0,i=0;for(let a of t)if(n=U(n,a,e,F),n.status===2||(r=n.player.ground===1&&!(a&4)?r+1:0,r>i&&(i=r),n.status===3))break;return i}function mt(e,t){return $(Math.abs(e-X),X)+$(Math.abs(t-492),492)}function ht(e,t){let n;try{n=ct(e)}catch(e){return`assemblage : ${e.message}`}let r=lt(n);if(typeof r==`string`)return r;let i={simVersion:3,levelId:t,start:{checkpoint:-1,held:0,time:0,sections:[],elan:0},runs:ge(r.inputs)},a=Te(n.level,i,t);if(!a.finished)return`le rejeu n'arrive pas`;if(a.deaths.length>0)return`le rejeu meurt ${a.deaths.length} fois`;let o=a.time,s=n.pieces.map((e,t)=>({...e,start:r.starts[t],end:t+1<n.pieces.length?r.starts[t+1]:o})),c={id:t,level:n.level,ascii:n.ascii,hash:J(n.ascii),pieces:s,paliers:n.paliers,palierTicks:ft(n.level,n.paliers,r.inputs),longestRun:pt(n.level,r.inputs),replay:i,code:ye(i),authorTicks:o,medals:nt(o),exigence:ut(s,o)};return{built:c,problems:dt(c)}}let gt=[{id:`mur-seul`,variant:4},{id:`ressorts-escalier`,variant:0},{id:`plongeon`,variant:0},{id:`tunnel-scies`,variant:1},{id:`iles-scie`,variant:2},{id:`escalier`,variant:1},{id:`piliers`,variant:1},{id:`puits-descente`,variant:2},{id:`mur-friable`,variant:2},{id:`marelle`,variant:2}],_t=/* @__PURE__ */ new Map;function vt(n){let r=_t.get(n);if(r)return r;let i=qe(n),o=t(n,1785689458),s=[],c=null;for(let r=0;r<40&&!(r>=6&&c);r++){let a=st(n,new e(t(o,r)));if(typeof a==`string`){s.push({index:r,status:`impasse`,reason:a,pieces:[],ticks:0,rate:0,score:0});continue}let l=a.map(e=>`${e.choice.id}:${e.choice.variant}`),u=ht(a.map(e=>({id:e.choice.id,variant:e.choice.variant})),i);if(typeof u==`string`){s.push({index:r,status:`refusé`,reason:u,pieces:l,ticks:0,rate:0,score:0});continue}let{built:d,problems:f}=u,p=mt(d.authorTicks,d.exigence.rate),m=f.length>0?`refusé`:`valide`;s.push({index:r,status:m,reason:f.join(` ; `),pieces:l,ticks:d.authorTicks,rate:d.exigence.rate,score:p}),!(f.length>0)&&(!c||p<c.score)&&(c={built:d,index:r,score:p})}let l;if(c)l={...c.built,day:n,date:a(n),number:Ke(n),attempts:s,chosen:c.index,fallback:!1};else{let e=ht(gt,i);if(typeof e==`string`||e.problems.length>0)throw Error(`Niveau de secours invalide : ${typeof e==`string`?e:e.problems.join(` ; `)}`);l={...e.built,day:n,date:a(n),number:Ke(n),attempts:s,chosen:-1,fallback:!0}}return _t.set(n,l),l}function yt(e){return{format:1,simVersion:3,generatorVersion:4,day:e.day,id:e.id,ascii:e.ascii,hash:e.hash,pieces:e.pieces.map(e=>({...e,tags:[...e.tags]})),paliers:e.paliers.map(e=>({...e})),palierTicks:[...e.palierTicks],longestRun:e.longestRun,code:e.code,authorTicks:e.authorTicks,exigence:{sum:e.exigence.sum,rate:e.exigence.rate,thirds:[...e.exigence.thirds]},attempts:e.attempts.map(e=>({...e,pieces:[...e.pieces]})),chosen:e.chosen,fallback:e.fallback}}function bt(e){return yt(vt(e))}self.onmessage=e=>{let t;try{t={ok:!0,payload:bt(e.data.day)}}catch(e){t={ok:!1,error:e instanceof Error?e.message:String(e)}}self.postMessage(t)}})();