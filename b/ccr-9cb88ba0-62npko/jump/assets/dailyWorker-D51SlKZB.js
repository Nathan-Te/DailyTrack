(function(){var e=class{state;constructor(e){this.state=e>>>0}next(){this.state=this.state+1831565813>>>0;let e=this.state;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}int(e){return this.next()%e}chance(e){return this.int(100)<e}pick(e){return e[this.int(e.length)]}shuffle(e){let t=e.slice();for(let e=t.length-1;e>0;e--){let n=this.int(e+1);[t[e],t[n]]=[t[n],t[e]]}return t}};function t(e,t){let n=Math.imul((e|0)^2654435769,2246822507);return n^=n>>>13,n=Math.imul(n^(t|0),3266489909),n^=n>>>16,n>>>0}function n(e,t,n){let r=t<=2?e-1:e,i=Math.floor(r/400),a=r-i*400,o=Math.floor((153*(t+(t>2?-3:9))+2)/5)+n-1,s=a*365+Math.floor(a/4)-Math.floor(a/100)+o;return i*146097+s-719468}function r(e){let t=e+719468,n=Math.floor(t/146097),r=t-n*146097,i=Math.floor((r-Math.floor(r/1460)+Math.floor(r/36524)-Math.floor(r/146096))/365),a=r-(365*i+Math.floor(i/4)-Math.floor(i/100)),o=Math.floor((5*a+2)/153),s=a-Math.floor((153*o+2)/5)+1,c=o+(o<10?3:-9);return{y:i+n*400+ +(c<=2),m:c,d:s}}let i=(e,t)=>{let n=String(e);for(;n.length<t;)n=`0`+n;return n};function a(e){let{y:t,m:n,d:a}=r(e);return`${i(t,4)}-${i(n,2)}-${i(a,2)}`}var o=class extends Error{constructor(e){super(e),this.name=`CodecError`}};let s=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`;function c(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2];t+=s[r>>2],t+=s[(r&3)<<4|(i??0)>>4],i!==void 0&&(t+=s[(i&15)<<2|(a??0)>>6]),a!==void 0&&(t+=s[a&63])}return t}function l(e){let t=[],n=0,r=0;for(let i=0;i<e.length;i++){let a=s.indexOf(e[i]);if(a<0)throw new o(`caractère invalide`);n=n<<6|a,r+=6,r>=8&&(r-=8,t.push(n>>r&255),n&=(1<<r)-1)}if(r>=6)throw new o(`longueur invalide`);return t}function u(e,t){for(;t>=128;)e.push(t&127|128),t>>=7;e.push(t)}function d(e,t=21){let n=0,r=0;for(;;){let i=e();if(n+=(i&127)*(1<<r),!(i&128))return n;if(r+=7,r>t)throw new o(`entier trop long`)}}let f=4096;function p(e,t){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t))throw RangeError(`idiv attend des entiers sûrs (${e}, ${t})`);if(t===0)throw RangeError(`idiv : division par zéro`);return(e-e%t)/t+0}function m(e){return e>=1&&e<=3}function h(e){return e>=4&&e<=7}let g=72e3,_=1792,v=5632;var y=class extends Error{constructor(e){super(e),this.name=`LevelError`}};let b={"#":1,".":0,S:0,F:0,C:0,o:0,O:0,x:2,"*":3,"^":4,v:5,"<":6,">":7},x=p(f,2),S=(e,t)=>({x:e*f+x,y:t*f+x});function C(e,t){let n=/^(\d+)(?:\.(\d{1,6}))?$/.exec(e);if(!n)throw new y(`${t} : « ${e} » n'est pas un nombre de tuiles`);let r=n[2]??``,i=1;for(let e=0;e<r.length;e++)i*=10;return p((Number(n[1])*i+(r?Number(r):0))*f*2+i,i*2)}function w(e,t,n){let r=t===`aller-retour`?[...e,...e.slice(1,-1).reverse()]:[...e],i=[],a=0;for(let e=0;e<r.length;e++){let t=r[e],n=r[(e+1)%r.length],o=(t.x>n.x?t.x-n.x:n.x-t.x)+(t.y>n.y?t.y-n.y:n.y-t.y);i.push(o),a+=o}let o=[0],s=0;for(let e=0;e<r.length;e++)s+=i[e],o.push(a===0?n:p(n*s,a));return{nodes:r,times:o}}function T(e){let t=e.replace(/\r/g,``).split(`
`);for(;t.length>0&&t[0].trim()===``;)t.shift();for(;t.length>0&&t[t.length-1].trim()===``;)t.pop();if(t.length===0)throw new y(`Niveau vide`);let n=t.findIndex(e=>e.trim()===``);n<0&&(n=t.length);let r=t.slice(0,n),i=t.slice(n),a=r[0].length,o=r.length;if(a>2048||o>512)throw new y(`Niveau trop grand (${a} × ${o}, au plus 2048 × 512)`);let s=[],c=[],l=[],u=[],d=[],f=[],p=[];for(let e=0;e<o;e++){let t=r[e];if(t.length!==a)throw new y(`Ligne ${e+1} : ${t.length} colonnes au lieu de ${a}`);for(let n=0;n<a;n++){let r=t[n],i=b[r];if(i===void 0)throw new y(`Ligne ${e+1}, colonne ${n+1} : caractère « ${r} » inconnu`);if(s.push(i),f.push(i===2?d.length:-1),i===2&&d.push({col:n,row:e}),r===`S`&&c.push({col:n,row:e}),r===`F`&&l.push({col:n,row:e}),r===`C`&&p.push({col:n,row:e}),r===`o`||r===`O`){let t=S(n,e);u.push({id:`${r}${u.length}`,radius:r===`o`?_:v,mode:`fixe`,points:[t],cycle:0,section:-1,nodes:[t],times:[0,0]})}}}p.sort((e,t)=>e.col-t.col||e.row-t.row);for(let e=1;e<p.length;e++)if(p[e].col===p[e-1].col)throw new y(`Deux points de passage « C » dans la colonne ${p[e].col+1} (un seul par colonne)`);if(c.length!==1)throw new y(`Il faut exactement un départ « S » (${c.length} trouvés)`);if(l.length!==1)throw new y(`Il faut exactement une arrivée « F » (${l.length} trouvées)`);let m=[],h=[];for(let e=0;e<i.length;e++){let t=i[e].trim();if(t===``||t.startsWith(`//`))continue;let r=t.split(/\s+/),o=`Annexe, ligne ${n+e+1}`;if(r[0]===`section`){let e=r.length===3?/^(\d+)-(\d+)$/.exec(r[2]):null;if(!e)throw new y(`${o} : « section <nom> <col0>-<col1> » attendu`);let t=Number(e[1]),n=Number(e[2]);if(t>n||n>=a)throw new y(`${o} : colonnes ${t}-${n} hors de la grille (0-${a-1})`);if(m.some(e=>e.name===r[1]))throw new y(`${o} : section « ${r[1]} » déjà déclarée`);let i=m.find(e=>t<=e.c1&&e.c0<=n);if(i)throw new y(`${o} : chevauche la section « ${i.name} »`);m.push({name:r[1],c0:t,c1:n})}else if(r[0]===`scie`)h.push({line:n+e+1,words:r});else throw new y(`${o} : déclaration « ${r[0]} » inconnue (section, scie)`)}for(let{line:e,words:t}of h){let n=`Annexe, ligne ${e}`;if(t.length<7)throw new y(`${n} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);let[,r,i,s,c]=t;if(u.some(e=>e.id===r))throw new y(`${n} : scie « ${r} » déjà déclarée`);let l=i===`o`?_:i===`O`?v:C(i,n);if(l<=0||l>16384)throw new y(`${n} : rayon hors bornes (au plus 4 tuiles)`);if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>72e3)throw new y(`${n} : cycle en pas attendu (1 à ${g})`);if(c!==`aller-retour`&&c!==`boucle`)throw new y(`${n} : mode « ${c} » inconnu (aller-retour, boucle)`);let d=t.slice(5).map(e=>{let t=/^(\d+),(\d+)$/.exec(e);if(!t)throw new y(`${n} : point « ${e} » (col,rangée) attendu`);let r={col:Number(t[1]),row:Number(t[2])};if(r.col>=a||r.row>=o)throw new y(`${n} : point ${e} hors de la grille`);return r});if(d.length>32)throw new y(`${n} : au plus 32 points`);let f=m.findIndex(e=>d[0].col>=e.c0&&d[0].col<=e.c1);if(f<0)throw new y(`${n} : le premier point (colonne ${d[0].col}) n'est dans aucune section`);let p=d.map(e=>S(e.col,e.row)),h=Number(s);u.push({id:r,radius:l,mode:c,points:p,cycle:h,section:f,...w(p,c,h)})}return{width:a,height:o,tiles:s,start:c[0],finish:l[0],sections:m,saws:u,crumbles:d,crumbleIndex:f,checkpoints:p}}function E(e,t,n){return n>=e.height?0:t<0||n<0||t>=e.width?1:e.tiles[n*e.width+t]}function D(e,t){if(e.cycle===0||t<=0)return e.nodes[0];let n=t%e.cycle,r=e.nodes.length,i=0;for(;i<r-1&&n>=e.times[i+1];)i++;let a=e.nodes[i],o=e.nodes[(i+1)%r],s=e.times[i],c=e.times[i+1]-s;return c<=0?a:{x:a.x+p((o.x-a.x)*(n-s),c),y:a.y+p((o.y-a.y)*(n-s),c)}}function O(e){return e>>12}function k(e,t,n,r,i){for(let a=r;a<=i;a++)for(let r=t;r<=n;r++)if(m(E(e,r,a)))return!0;return!1}function A(e,t,n,r,i){return k(e,O(t),O(t+r-1),O(n),O(n+i-1))}function j(e,t,n,r,i,a,o){if(r===0)return{pos:t,blocked:!1};let s=O(i),c=O(i+a-1),l=t=>o?k(e,t,t,s,c):k(e,s,c,t,t);if(r>0){let e=O(t+n-1)+1,i=O(t+n+r-1);for(let t=e;t<=i;t++)if(l(t))return{pos:t*f-n,blocked:!0}}else{let e=O(t)-1,n=O(t+r);for(let t=e;t>=n;t--)if(l(t))return{pos:(t+1)*f,blocked:!0}}return{pos:t+r,blocked:!1}}let M=3072,N=3072,P=2048,F=Object.freeze({runSpeed:375,groundAccel:17,groundDecel:32,airAccel:13,airDecel:6,gravity:19,fallSpeed:751,jumpSpeed:800,jumpCut:340,slideSpeed:171,wallJumpX:340,wallJumpY:680,wallLock:0,wallReach:512,coyote:10,wallCoyote:6,jumpBuffer:12,cornerTolerance:1024,crumbleDelay:30,springSpeed:1056,sprintMode:1,sprintSpeed:614,sprintDelay:42,sprintAccel:3});Object.keys(F),Object.freeze({...F,sprintMode:0});function I(e){let t=e.sprintSpeed;return t<e.runSpeed?e.runSpeed:t>2048?P:t}function L(e){let t=e.start.col*f+p(1024,2),n=(e.start.row+1)*f-N,r=+!!A(e,t,n+1,3072,3072);return{x:t,y:n,vx:0,vy:0,ground:r,air:r?0:255,wallSide:0,wallAir:255,slide:0,buffer:0,held:0,jumping:0,lock:0,lockDir:0,sprint:0}}let ee=(e,t,n)=>e<t?t:e>n?n:e,R=(e,t,n)=>e<t?e+n>t?t:e+n:e-n<t?t:e-n;function z(e,t,n,r,i){let a=O(n),o=O(n+N-1),s=r<0?t:t+M,c=r<0?O(t)-1:O(t+M-1)+1,l=O(r<0?t-i-1:t+M+i);for(let t=c;r<0?t>=l:t<=l;t+=r)for(let n=a;n<=o;n++)if(m(E(e,t,n)))return r<0?s-(t+1)*f:t*f-s;return-1}function B(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=r,a=(t&2?1:0)-(t&1?1:0),o=t&4?1:0,s=o===1&&e.held===0;e.lock>0&&a===e.lockDir&&(a=0);let c=e.lock>0?e.lock-1:0,l=c>0?e.lockDir:0,u=e.ground===1,d=u?i.groundAccel:i.airAccel,p=u?i.groundDecel:i.airDecel,h=i.sprintMode===1,g=h?e.sprint:0,_=e.vx;if(a===0)_=R(_,0,p);else if(_*a<0)_=R(_,a*i.runSpeed,d>p?d:p);else if(h&&g>=i.sprintDelay&&_*a>=i.runSpeed&&I(i)>i.runSpeed){let e=I(i);_*a>e?_=R(_,a*e,p):u&&(_=R(_,a*e,i.sprintAccel))}else _=_*a>i.runSpeed?R(_,a*i.runSpeed,p):R(_,a*i.runSpeed,d);let v=e.vy,y=0;!u&&v>=0&&a!==0&&z(n,e.x,e.y,a,1)===0&&(y=a);let b=y===0?i.fallSpeed:i.slideSpeed;v=v<b?v+i.gravity>b?b:v+i.gravity:v-i.gravity<b?b:v-i.gravity;let x=e.air,S=e.wallAir,C=e.jumping,w=!1,T=!1;if(s||e.buffer>0){if(u||e.air<=i.coyote)v=-i.jumpSpeed,w=!0,x=255;else{let t=z(n,e.x,e.y,-1,i.wallReach),r=z(n,e.x,e.y,1,i.wallReach),o=0;t>=0&&r>=0?o=a===0?t<=r?-1:1:a:t>=0?o=-1:r>=0?o=1:e.wallSide!==0&&e.wallAir<=i.wallCoyote&&(o=e.wallSide),o!==0&&(_=-o*i.wallJumpX,v=-i.wallJumpY,w=!0,T=!0,y=0,S=255,c=i.wallLock,l=c>0?o:0)}}w&&(C=1);let D=w?0:s?i.jumpBuffer:e.buffer>0?e.buffer-1:0;C===1&&o===0&&v<-i.jumpCut&&(v=-i.jumpCut,C=0),v>=0&&(C=0),_=ee(_,-2048,P),v=ee(v,-2048,P);let k=e.x,F=e.y,L=j(n,k,M,_,F,N,!0);k=L.pos,L.blocked&&(_=0);let B=j(n,F,N,v,k,M,!1);if(B.blocked&&v<0&&i.cornerTolerance>0){let e=O(B.pos)-1,t=O(k),r=O(k+M-1),a=m(E(n,t,e)),o=m(E(n,r,e)),s=k;t!==r&&a&&!o&&(t+1)*4096-k<=i.cornerTolerance?s=(t+1)*f:t!==r&&o&&!a&&k+3072-r*4096<=i.cornerTolerance&&(s=r*f-M),s!==k&&!A(n,s,F,3072,3072)&&(k=s,B=j(n,F,N,v,k,M,!1))}F=B.pos,B.blocked&&(v<0&&(C=0),v=0);let V=v>=0&&A(n,k,F+1,3072,3072)?1:0;V?x=0:x<255&&(x+=1);let H=e.wallSide;if(V)H=0,S=255;else{let e=z(n,k,F,-1,1)===0,t=z(n,k,F,1,1)===0;e===t?e&&t?(H=a===0?H:a,S=0):S<255&&(S+=1):(H=e?-1:1,S=0)}return V&&(C=0),h&&(a===0||e.vx*a<0||L.blocked||y!==0||T?g=0:u&&(g=_*a===i.runSpeed||g>=i.sprintDelay&&_*a>i.runSpeed?g<i.sprintDelay?g+1:i.sprintDelay:0)),{x:k,y:F,vx:_+0,vy:v+0,ground:V,air:x,wallSide:H,wallAir:S,slide:y,buffer:D,held:o,jumping:C,lock:c,lockDir:l,sprint:g}}let V=1024,H=2048;function te(e,t,n){let r=f,i=t*r,a=n*r,o=r-2*V;switch(e){case 4:return{x:i+V,y:a+r-H,w:o,h:H};case 5:return{x:i+V,y:a,w:o,h:H};case 6:return{x:i+r-H,y:a+V,w:H,h:o};case 7:return{x:i,y:a+V,w:H,h:o};default:throw RangeError(`spikeBox : la tuile ${e} n'est pas un pic`)}}function ne(e,t){return e.x<t.x+t.w&&t.x<e.x+e.w&&e.y<t.y+t.h&&t.y<e.y+e.h}let re=(e,t,n)=>e<t?t:e>n?n:e;function ie(e,t,n){let r=e-re(e,n.x,n.x+n.w),i=t-re(t,n.y,n.y+n.h);return r*r+i*i}function ae(e,t,n,r){return ie(e,t,r)<n*n}function U(e){return{status:0,time:0,player:L(e),tiles:e.tiles,crumbles:e.crumbles.map(()=>0),sections:e.sections.map(()=>-1),deathCause:0,deathX:0,deathY:0,deathTicks:0,springCell:-1,springTime:0,checkpoint:-1}}function oe(e,t){let n=e.checkpoints[t.checkpoint],r=t.sections.map((t,r)=>e.sections[r].c1>=n.col?-1:t);return{...U(e),status:1,time:t.time,player:L({...e,start:n}),sections:r,checkpoint:t.checkpoint}}function se(e,t,n){let r=e.saws[n];if(r.section<0)return 0;let i=t.sections[r.section];return i<0?0:t.time-i}function ce(e){return{x:e.x,y:e.y,w:M,h:N}}function le(e,t){let n=t.player;if(n.y+3072>e.height*4096)return 3;let r=ce(n),i=O(n.x),a=O(n.x+M-1),o=O(n.y)<0?0:O(n.y),s=O(n.y+N-1);for(let t=o;t<=s;t++)for(let n=i;n<=a;n++){if(n<0||n>=e.width)continue;let i=e.tiles[t*e.width+n];if(h(i)&&ne(r,te(i,n,t)))return 1}for(let n=0;n<e.saws.length;n++){let i=e.saws[n],a=D(i,se(e,t,n));if(ae(a.x,a.y,i.radius,r))return 2}return 0}function ue(e,t){let n=f;return ne(ce(t),{x:e.finish.col*n,y:e.finish.row*n,w:n,h:n})}function de(e,t){return t===e.tiles?e:{width:e.width,height:e.height,tiles:t}}function fe(e,t,n){return t<0||n<0||t>=e.width||n>=e.height?-1:n*e.width+t}function W(e,t,n,r){if(!Number.isInteger(t)||t<0||t>7)throw RangeError(`Commande invalide : ${t}`);let i=t&4?1:0;if(e.status===3)return e;if(e.status===2){let t=e.deathTicks+1,r=e.checkpoint>=0?e.time+1:e.time;if(t<18)return{...e,deathTicks:t,time:r};if(e.checkpoint>=0){let t=oe(n,{...e,time:r});return i&&(t.player={...t.player,held:1}),t}let a=U(n);return i&&(a.player={...a.player,held:1}),a}if(e.status===0){let n=t&3;if(!(n===1||n===2||i===1&&e.player.held===0))return e.player.held===i?e:{...e,player:{...e.player,held:i}}}let a=f,o=e.tiles,s=e.crumbles;for(let t=0;t<s.length;t++){let r=s[t];if(!(r<=0)&&(s===e.crumbles&&(s=[...s]),s[t]=r>1?r-1:-1,r===1)){o===e.tiles&&(o=[...o]);let r=n.crumbles[t];o[r.row*n.width+r.col]=0}}let c=B(e.player,t,de(n,o),r),l=c.ground===1,u=O(c.x),d=O(c.x+M-1),m=e.springCell,h=e.springTime;if(l&&r.springSpeed>0){let t=O(c.y+N),i=O(c.x+p(M,2)),a=-1;for(let e of[i,u,d]){let r=fe(n,e,t);if(r>=0&&o[r]===3){a=r;break}}if(a>=0){let t=r.springSpeed<2048?r.springSpeed:P;c={...c,vy:-t,ground:0,air:255,jumping:0,buffer:0},m=a,h=e.time+1}}let g=(t,i)=>{let a=fe(n,t,i);if(a<0)return;let o=n.crumbleIndex[a];o<0||s[o]!==0||(s===e.crumbles&&(s=[...s]),s[o]=r.crumbleDelay>1?r.crumbleDelay:1)};if(l){let e=O(c.y+N);for(let t=u;t<=d;t++)g(t,e)}else{let e=(t&2?1:0)-(t&1?1:0),n=O(c.y),r=O(c.y+N-1);if(e>0&&(c.x+3072)%a==0)for(let e=n;e<=r;e++)g(O(c.x+M),e);if(e<0&&c.x%a==0)for(let e=n;e<=r;e++)g(O(c.x)-1,e)}let _=e.time+1,v=e.sections,y=O(c.x+p(M,2));for(let t=0;t<v.length;t++){let r=n.sections[t];v[t]>=0||y<r.c0||y>r.c1||(v===e.sections&&(v=[...v]),v[t]=_)}let b={...e,status:1,time:_,player:c,tiles:o,crumbles:s,sections:v,springCell:m,springTime:h};if(ue(n,c))return{...b,status:3};let x=le(n,b);if(x!==0)return{...b,status:2,deathCause:x,deathX:c.x+p(M,2),deathY:c.y+p(N,2),deathTicks:0};let S=O(e.player.x+p(M,2));if(y>S){let e=b.checkpoint;for(let t=0;t<n.checkpoints.length;t++){let r=n.checkpoints[t].col;S<r&&r<=y&&(e=t)}if(e!==b.checkpoint)return{...b,checkpoint:e}}return b}T(`
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
`);let G=72e3,pe=/^[a-z0-9_:-]{1,40}$/;var K=class extends Error{code;constructor(e,t){super(t),this.code=e,this.name=`JumpReplayError`}};Object.freeze({checkpoint:-1,held:0,time:0,sections:Object.freeze([]),elan:0});function me(e){let t=0;for(let n of e)t+=n.count;return t}function he(e){let t=[];for(let n of e){let e=t[t.length-1];e&&e.bits===n?e.count++:t.push({count:1,bits:n})}return t}function ge(e){let t=[];for(let n of e)for(let e=0;e<n.count;e++)t.push(n.bits);return t}function _e(e){if(!pe.test(e))throw new K(`format`,`Identifiant de niveau invalide : « ${e} »`)}function ve(e){_e(e.levelId);let t=e.start,n=[1];u(n,e.simVersion),n.push(e.levelId.length);for(let t=0;t<e.levelId.length;t++)n.push(e.levelId.charCodeAt(t));let r=t.checkpoint>=0;if(r&&t.elan)throw new K(`format`,`Départ lancé sur un point de passage`);if(t.elan!==0&&t.elan!==1&&t.elan!==2)throw new K(`format`,`Départ lancé inconnu : ${t.elan}`);if(n.push(!!t.held|(r?2:0)|(t.elan===1?4:0)|(t.elan===2?8:0)),r){u(n,t.checkpoint),u(n,t.time),u(n,t.sections.length);for(let e of t.sections)u(n,e+1)}let i=0;for(let t of e.runs){if(!Number.isInteger(t.count)||t.count<1)throw new K(`format`,`Série vide`);if(!Number.isInteger(t.bits)||t.bits<0||t.bits>7)throw new K(`format`,`Commande invalide : ${t.bits}`);if(i+=t.count,i>G)throw new K(`length`,`Rediffusion trop longue (plus de ${G} pas)`);u(n,t.count*8+t.bits)}return c(n)}function ye(e){if(typeof e!=`string`||e.length===0)throw new K(`format`,`Rediffusion vide`);let t;try{t=l(e)}catch(e){throw e instanceof o?new K(`format`,`Rediffusion illisible (${e.message})`):e}let n=0,r=()=>{let e=t[n++];if(e===void 0)throw new K(`format`,`Rediffusion tronquée`);return e},i=e=>{try{return d(r)}catch(t){throw t instanceof o?new K(`format`,`${e} : entier trop long`):t}},a=r();if(a!==1)throw new K(`format`,`Format de rediffusion inconnu (${a})`);let s=i(`Version`),c=r(),u=``;for(let e=0;e<c;e++)u+=String.fromCharCode(r());_e(u);let f=r();if(f&-16)throw new K(`format`,`Drapeaux de départ inconnus`);if(f&2&&f&12)throw new K(`format`,`Départ lancé sur un point de passage`);if(f&4&&f&8)throw new K(`format`,`Départ lancé à la course et en élan plein`);let m={checkpoint:-1,held:f&1?1:0,time:0,sections:[],elan:f&8?2:f&4?1:0};if(f&2){let e=i(`Point de passage`),t=i(`Chrono`),n=i(`Sections`);if(e>=4096)throw new K(`format`,`Point de passage hors limites`);if(t>G)throw new K(`length`,`Chrono de départ trop long`);if(n>256)throw new K(`format`,`Trop de sections`);let r=[];for(let e=0;e<n;e++){let e=i(`Section`)-1;if(e>t)throw new K(`format`,`Section mise en marche après le départ`);r.push(e)}m.checkpoint=e,m.time=t,m.sections=r}let h=[],g=0;for(;n<t.length;){let e=i(`Série`),t=e%8,n=p(e-t,8);if(n<1)throw new K(`format`,`Série vide`);if(g+=n,g>G)throw new K(`length`,`Rediffusion trop longue (plus de ${G} pas)`);h.push({count:n,bits:t})}return{simVersion:s,levelId:u,start:m,runs:h}}function be(e,t){if(t.checkpoint<0){let n=U(e);if(!t.held&&!t.elan)return n;let r=F,i=t.elan===2?I(r):t.elan?r.runSpeed:0;return{...n,player:{...n.player,held:+!!t.held,vx:i,sprint:t.elan===2?r.sprintDelay:0}}}if(t.elan)throw new K(`format`,`Départ lancé sur un point de passage`);if(t.checkpoint>=e.checkpoints.length)throw new K(`level`,`Point de passage ${t.checkpoint} absent de ce niveau`);if(t.sections.length!==e.sections.length)throw new K(`level`,`Nombre de sections différent de celui du niveau`);let n=oe(e,{...U(e),checkpoint:t.checkpoint,time:t.time,sections:t.sections});return t.held?{...n,player:{...n.player,held:1}}:n}function xe(e){return{checkpoint:e.checkpoint,held:e.player.held,time:e.time,sections:[...e.sections],elan:0}}function Se(e,t,n){if(t.simVersion!==4)throw new K(`version`,`Rediffusion d'une autre version de la simulation (${t.simVersion}, actuelle 4)`);if(n!==void 0&&t.levelId!==n)throw new K(`level`,`Rediffusion d'un autre niveau (« ${t.levelId} »)`);if(me(t.runs)>G)throw new K(`length`,`Rediffusion trop longue (plus de ${G} pas)`);return be(e,t.start)}function Ce(e,t){return t.status===3||t.status===2&&e.status!==2&&t.checkpoint<0}function we(e,t,n){let r=Se(e,t,n),i=[],a=[],o={start:{...t.start,sections:[...t.start.sections]},startTick:0,runs:[],ticks:0},s=0,c=!1;for(let n of t.runs)for(let t=0;t<n.count;t++){if(c)throw new K(`format`,`Pas après la fin de l'essai (pas ${s+1})`);let t=r;if(r=W(t,n.bits,e,F),s++,o){let e=o.runs[o.runs.length-1];e&&e.bits===n.bits?e.count++:o.runs.push({count:1,bits:n.bits}),o.ticks++}if(r.status===2&&t.status!==2){let e={cause:r.deathCause,x:r.deathX,y:r.deathY};i.push({tick:s,time:r.time,...e,life:a.length}),o&&a.push({index:a.length,...o,end:`mort`,death:e}),o=null}else r.status===1&&t.status===2?o={start:xe(r),startTick:s,runs:[],ticks:0}:r.status===3&&t.status!==3&&o&&(a.push({index:a.length,...o,end:`arrivée`,death:null}),o=null);Ce(t,r)&&(c=!0)}return o&&o.ticks>0&&a.push({index:a.length,...o,end:`abandon`,death:null}),{finished:r.status===3,ticks:s,time:r.time,deaths:i,lives:a,final:r}}let Te=[`id: ascenseur
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
`,`id: cheminee-pics
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
`,`id: cheminee-scie
intention: Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment.
etiquettes: mural scie vertical
famille: cheminee
mutateurs: patrouille denivele
format: 3
paliers: 17 6
repeter: haut rangees 10-10
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
`,`id: cheminee-vide
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
`,`id: cheminee
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
`,`id: chute-pics
intention: Tomber au fond d'un puits étroit en esquivant les pics des parois, à gauche puis à droite.
etiquettes: precision vertical
famille: chute
mutateurs: patrouille garde denivele
format: 3
paliers: 4 25
repeter: prof rangees 12-12
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
`,`id: corniches
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
`,`id: demi-tour
intention: Sauter contre le bas d'un mur hérissé, rebondir en arrière sur une corniche, puis repartir par-dessus le mur.
etiquettes: mural
famille: demi-tour
mutateurs: sol-friable plafond denivele
format: 3
paliers: 15 8
repeter: ecart colonnes 6-6
variante: ecart=1
variante: ecart=2
variante: ecart=2 +sol-friable
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
`,`id: descente-scies
intention: Dévaler des corniches de plus en plus basses, bossues une sur deux, pendant que des scies montent et descendent entre elles.
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
###...###.....#..........................................
###...###...###..........................................
###...###...###..........................................
###...###...###...###....................................
###...###...###...###.....#..............................
###...###...###...###...###..............................
###...###...###...###...###..............................
###...###...###...###...###...###........................
###...###...###...###...###...###.....#..................
###...###...###...###...###...###...###..................
###...###...###...###...###...###...###..................
###...###...###...###...###...###...###...###............
###...###...###...###...###...###...###...###.....#......
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
`,`id: descente
intention: Descendre de corniche en corniche jusqu'en bas en enjambant les bosses, sans freiner.
etiquettes: respiration
famille: descente
mutateurs: denivele
format: 3
paliers: 4 16
repeter: large colonnes 3-3
repeter: large colonnes 6-6
repeter: large colonnes 9-9
repeter: large colonnes 12-12
repeter: large colonnes 15-15
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
#####..#............
########............
########............
###########.........
###########..#......
##############......
##############......
#################...
#################...
####################
####################
####################
####################

zone denivele 17-19
`,`id: elan-friable
intention: La piste s'effondre sous les pas : courir sans s'arrêter, prendre l'élan sur le friable et sauter les trous qui suivent.
etiquettes: elan friable
famille: elan-friable
mutateurs: fosse plafond denivele
format: 3
paliers: 9 9
repeter: piste colonnes 2-2
repeter: trou colonnes 5-5
repeter: trou colonnes 10-10
variante: piste=10 trou=10
variante: piste=10 trou=11
variante: piste=10 trou=12
variante: piste=10 trou=10 +fosse
variante: piste=10 trou=11 +plafond:pics
variante: piste=10 trou=11 +denivele:2
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
xxxxx.xxxx.#####
...........#####
...........#####

zone fosse 5 11
zone fosse 10 11
zone plafond 0-4 4
zone denivele 11-15
`,`id: elan-mur
intention: Un mur barre la piste : ne pas sauter contre lui (le saut mural coupe l'élan) mais filer par le passage bas, puis sauter le grand trou.
etiquettes: elan mural
famille: elan-mur
mutateurs: fosse denivele
format: 3
paliers: 13 13
repeter: piste colonnes 2-2
repeter: trou colonnes 10-10
variante: piste=5 trou=11
variante: piste=5 trou=12
variante: piste=5 trou=12 +fosse
variante: piste=5 trou=11 +fosse
grille:
..............
..............
..............
.....####.....
.....####.....
.....####.....
.....####.....
.....####.....
.....####.....
.....####.....
.....####.....
.....####.....
..............
##########.###
##########.###
##########.###

zone fosse 10 15
zone denivele 11-13
`,`id: elan-plafond
intention: Courir sous un plafond bas et enjamber les fosses par petits sauts : seul l'élan plein les fait passer, il ne faut jamais lâcher.
etiquettes: elan precision
famille: elan-plafond
mutateurs: sol-friable denivele
format: 3
paliers: 9 9
repeter: piste colonnes 2-2
repeter: fosse colonnes 5-5
repeter: fosse colonnes 10-10
repeter: fosse colonnes 15-15
variante: piste=10 fosse=5
variante: piste=9 fosse=5
variante: piste=10 fosse=5 +denivele:2
variante: piste=10 fosse=6
grille:
.####################
.####################
.####################
.####################
.####################
.####################
.####################
.....................
.....................
#####.####.####.#####
#####.####.####.#####
#####^####^####^#####

zone sol-friable 6-9 9
zone denivele 16-20
`,`id: elan-scie
intention: Prendre l'élan et franchir un très grand trou où une scie monte et descend : partir en élan plein, quand elle est en bas.
etiquettes: elan scie
famille: elan-scie
mutateurs: fosse denivele
format: 3
paliers: 10 10
repeter: piste colonnes 2-2
repeter: trou colonnes 13-13
variante: piste=1 trou=11 cycle=240
variante: piste=1 trou=12 cycle=240
grille:
...................
...................
...................
...................
...................
...................
...................
...................
...................
...................
#############.#####
#############.#####
#############.#####
#############.#####
#############.#####
#############.#####

scie patrouille o {cycle} aller-retour 13,6 13',6
zone fosse 13 15
zone denivele 14-18
`,`id: elan-traversee
intention: Prendre l'élan, franchir deux très grands trous coupés d'une marche à ne pas heurter, puis enjamber à petits sauts les fosses d'un couloir bas sans jamais lâcher.
etiquettes: elan precision
famille: elan-traversee
enchainement: long
mutateurs: fosse denivele
format: 3
paliers: 17 14
repeter: trou colonnes 13-13
repeter: saut colonnes 32-32
repeter: fosse colonnes 41-41
repeter: fosse colonnes 46-46
repeter: fosse colonnes 51-51
variante: trou=12 saut=12 fosse=4
variante: trou=11 saut=12 fosse=5
variante: trou=12 saut=13 fosse=4
variante: trou=12 saut=12 fosse=4 +fosse
variante: trou=11 saut=12 fosse=5 +denivele:2
grille:
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
......................................################..
........................................................
........................................................
...................#############.########.####.####.####
...................#############.########.####.####.####
...................#############.########.####.####.####
#############.##################.########.####.####.####
#############.##################.########.####.####.####
#############.##################.########^####^####^####

zone fosse 13 19
zone fosse 32 19
zone denivele 54-55
`,`id: escalier-friable
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
`,`id: grand-saut
intention: Prendre tout son élan sur la piste et franchir deux très grands trous de suite : sans l'élan plein, le premier est trop large.
etiquettes: elan precision
famille: grand-saut
mutateurs: fosse sol-friable denivele
format: 3
paliers: 9 9
repeter: piste colonnes 2-2
repeter: trou colonnes 4-4
repeter: trou colonnes 8-8
variante: piste=10 trou=13
variante: piste=11 trou=13
variante: piste=10 trou=13 +denivele:2
variante: piste=11 trou=14
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
####.###.######
####.###.######
####.###.######

zone fosse 4 11
zone fosse 8 11
zone sol-friable 0-3 9
zone denivele 9-14
`,`id: grande-scie
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
`,`id: iles-friables
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
`,`id: iles-scie
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
`,`id: lucarne
intention: Passer d'un saut par les fenêtres de trois murs minces, chacune à une autre hauteur.
etiquettes: precision
famille: lucarne
mutateurs: sol-friable garde denivele
format: 3
paliers: 10 10
repeter: fenetre rangees 6-6
variante: fenetre=2
variante: fenetre=1
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
`,`id: marelle
intention: Sauter de dalle en dalle, une haute, une basse, au-dessus d'un sol hérissé.
etiquettes: precision
famille: marelle
mutateurs: sol-friable plafond denivele
format: 3
paliers: 9 9
repeter: ecart colonnes 7-7
repeter: ecart colonnes 12-12
repeter: ecart colonnes 17-17
variante: ecart=2
variante: ecart=1 +sol-friable
variante: ecart=2 +plafond:pics
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
`,`id: mur-friable
intention: Monter une cheminée au-dessus d'un puits de pics : son mur gauche s'effrite, pas question de traîner, puis le seuil cède aussi.
etiquettes: mural friable vertical
famille: cheminee
mutateurs: plafond denivele
format: 3
paliers: 17 7
repeter: haut rangees 10-10
variante: haut=2
variante: haut=4
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
`,`id: mur-seul
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
`,`id: mur-trous
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
`,`id: paroi-friable
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
`,`id: pendule
intention: Traverser une salle où trois scies descendent du plafond tour à tour, en passant sous chacune quand elle remonte.
etiquettes: scie
famille: pendule
mutateurs: sol-friable plafond denivele
format: 3
paliers: 12 12
variante: cycle=180
variante: cycle=240
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
`,`id: petits-trous
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
`,`id: piliers-scie
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
`,`id: piliers
intention: Bondir de pilier en pilier, chacun large d'une seule tuile, au-dessus du vide.
etiquettes: precision
famille: piliers
mutateurs: patrouille sol-friable ressort denivele
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
variante: ecart=2 +ressort
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
zone ressort 14 10
zone denivele 22-23
`,`id: plafond-pics
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
variante: pics=3
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
`,`id: pont-friable
intention: Traverser un pont friable coupé de trous, tronçon après tronçon, sans jamais s'arrêter.
etiquettes: friable
famille: pont
mutateurs: plafond fosse denivele
format: 3
paliers: 9 9
repeter: ecart colonnes 6-6
repeter: ecart colonnes 11-11
repeter: ecart colonnes 16-16
variante: ecart=2
variante: ecart=3
variante: ecart=2 +plafond
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
`,`id: pont-patrouille
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
`,`id: puits-descente
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
`,`id: puits
intention: Se laisser glisser contre le mur d'un puits pour ne pas manquer la porte de sortie, puis sauter le trou du couloir.
etiquettes: mural vertical
famille: puits
mutateurs: garde fosse denivele
format: 3
paliers: 4 18
repeter: large colonnes 4-4
repeter: prof rangees 9-9
variante: large=1 prof=6
variante: large=2 prof=3 +fosse
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
`,`id: quinconce
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
`,`id: rebonds-doux
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
`,`id: ressort-mur-iles
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
`,`id: ressort-mur
intention: Prendre le ressort au pied d'un mur hérissé et retomber sur son sommet, sans frôler les pics.
etiquettes: ressort vertical
famille: ressort
mutateurs: plafond garde denivele
format: 3
paliers: 19 13
repeter: ecart colonnes 5-5
variante: ecart=1 +denivele:3
variante: ecart=1 +denivele:4
variante: ecart=1 +plafond:pics +denivele:3
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
`,`id: ressort-plafond
intention: Le ressort lance sous un plafond à pics : arriver assez vite pour le dépasser et se poser sur la corniche.
etiquettes: ressort precision
famille: ressort
mutateurs: sol-friable denivele
format: 3
paliers: 18 13
repeter: bord colonnes 7-7
variante: bord=1
variante: bord=2
variante: bord=2 +sol-friable
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
`,`id: ressorts-escalier
intention: Monter de ressort en ressort, chacun posé sur une corniche étroite plus haute, au-dessus du vide.
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
variante: ecart=2 +plafond:pics
variante: ecart=2 +fosse
variante: ecart=1 +plafond:pics
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
................#*....######
................##....######
................##....######
................##....######
.........#*.....##....######
.........##.....##....######
.........##.....##....######
.........##.....##....######
###*.....##.....##....######
####.....##.....##....######
####.....##.....##....######
####.....##.....##....######

zone plafond 4-21 1
zone fosse 4-7 25
zone fosse 11-14 25
zone fosse 18-21 25
zone denivele 22-27
`,`id: saut-long
intention: Deux grands trous coupés d'une île étroite, au bout d'une piste trop courte pour l'élan plein : chaque saut au dernier moment.
etiquettes: precision
famille: saut-long
mutateurs: plafond fosse denivele
format: 3
paliers: 9 9
repeter: trou colonnes 5-5
repeter: trou colonnes 9-9
variante: trou=7
variante: trou=8
variante: trou=9
variante: trou=8 +fosse
variante: trou=7 +denivele:3
variante: trou=7 +plafond:pics
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
#####.###.####
#####.###.####
#####.###.####

zone plafond 2-12 3
zone fosse 5 11
zone fosse 9 11
zone denivele 10-13
`,`id: saut-plafond
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
`,`id: scie-ronde
intention: Passer sous deux blocs suspendus pendant que la scie qui fait le tour de chacun est au-dessus.
etiquettes: scie
famille: scie-ronde
mutateurs: sol-friable denivele
format: 3
paliers: 10 10
variante: cycle=100
variante: cycle=100 +denivele:2
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
`,`id: scie-sol
intention: Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires.
etiquettes: scie
famille: scie-sol
mutateurs: patrouille sol-friable denivele
format: 3
paliers: 10 10
variante: cycle=300
variante: cycle=240
variante: cycle=180
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
`,`id: scies-jumelles
intention: Deux scies tournent en sens contraires autour de chaque borne : la sauter au moment où elles s'écartent.
etiquettes: scie precision
famille: scies-jumelles
mutateurs: sol-friable plafond denivele
format: 3
paliers: 10 10
variante: cycle=240
variante: cycle=180
variante: cycle=240 +sol-friable
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
`,`id: toboggan
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
variante: large=3
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
`,`id: tremplin
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
`,`id: tunnel-scies
intention: Traverser un couloir bas où roulent des scies en sens contraires, puis remonter la cheminée qui l'achève.
etiquettes: scie mural vertical
famille: tunnel-scies
enchainement: long
mutateurs: sol-friable
format: 3
paliers: 23 4
repeter: large colonnes 41-41
variante: large=1 cycle=720
variante: large=1 cycle=840
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
`,`id: tunnel
intention: Traverser un tunnel haut de plafond semé de bosses espacées : de petits sauts rythmés, sans se presser.
etiquettes: respiration
famille: tunnel
mutateurs: plafond denivele
format: 3
paliers: 9 9
repeter: long colonnes 3-6
variante: long=2
variante: long=3
variante: long=3 +denivele:2
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
`],Ee={jumpSimVersion:4,exigenceVersion:3,modules:{ascenseur:{variants:[{grid:`e99e544f`,arret:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjowAOICJqIFJuIDIEI`,ticks:208,entryTick:0,exitTick:202,exit:`course`,fastest:202,gigue:[905,680,565],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjowBHIIogEu8gQeogQIUg`,ticks:200,entryTick:17,exitTick:193,exit:`course`,fastest:176,gigue:[1e3,900,740],raccord:960,exigence:2},plein:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjowCIICjgH6BA`,ticks:128,entryTick:11,exitTick:124,exit:`plein`,fastest:113,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`48c29b3f`,arret:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjoxAPoCdooEZsIECEI`,ticks:219,entryTick:0,exitTick:212,exit:`course`,fastest:211,gigue:[1e3,1e3,965],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjoxBHIIwgFe2gMu-gQgWg`,ticks:208,entryTick:17,exitTick:201,exit:`course`,fastest:184,gigue:[900,735,520],raccord:960,exigence:3},plein:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjoxCKoBhgHaBQ`,ticks:128,entryTick:11,exitTick:124,exit:`plein`,fastest:113,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`816c738f`,arret:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjoyAOoCJtoFJoIEKEo`,ticks:222,entryTick:0,exitTick:215,exit:`course`,fastest:215,gigue:[895,745,695],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjoyBHIIogEu6gUeigQoSg`,ticks:215,entryTick:17,exitTick:208,exit:`course`,fastest:191,gigue:[1e3,820,710],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjoyCFommgNWigQ`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`e7a3286b`,arret:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjozAOoCJpoFJuIDIEI`,ticks:208,entryTick:0,exitTick:202,exit:`course`,fastest:202,gigue:[890,770,725],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjozBHIImgEu-gQeogQIUg`,ticks:200,entryTick:17,exitTick:193,exit:`course`,fastest:176,gigue:[1e3,860,835],raccord:960,exigence:2},plein:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjozCOoBlgGKBQ`,ticks:128,entryTick:11,exitTick:124,exit:`plein`,fastest:113,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7e1d7957`,arret:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjo0AIoDPqIFJqIEKEo`,ticks:226,entryTick:0,exitTick:219,exit:`course`,fastest:219,gigue:[625,565,600],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjo0BHIImgFO0gUeqgQoUg`,ticks:220,entryTick:17,exitTick:213,exit:`course`,fastest:196,gigue:[1e3,900,795],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmFzY2Vuc2V1cjo0CGou6gIm0gQ`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"cheminee-pics":{variants:[{grid:`9f932a66`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MACCAlYKhAEYLNUBKMYBCmZMYTTGBzBiCEo`,ticks:310,entryTick:0,exitTick:303,exit:`course`,fastest:303,gigue:[1e3,920,500],raccord:null,exigence:3},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MARyCPoBKEzNARDeARJuTRI5RrIHIEIISg`,ticks:295,entryTick:17,exitTick:288,exit:`course`,fastest:267,gigue:[935,540,220],raccord:1e3,exigence:4},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MAjaAS5iVWwwtgEqNjRtCS2iCAhC`,ticks:272,entryTick:11,exitTick:265,exit:`course`,fastest:254,gigue:[780,445,270],raccord:1e3,exigence:5}},{grid:`6a2ba0e7`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQDKAyhEpQEgxgESjgMapAFBLboBRqIGCEo`,ticks:346,entryTick:0,exitTick:339,exit:`course`,fastest:339,gigue:[675,505,210],raccord:null,exigence:5},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQRyCPoBMDStASDOAQqGAyKkAUEloggIQg`,ticks:334,entryTick:17,exitTick:327,exit:`course`,fastest:310,gigue:[830,305,95],raccord:1e3,exigence:4},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQjiAaEBhQIItgESlgMKfmUw9gIgRYYFCEo`,ticks:337,entryTick:11,exitTick:330,exit:`course`,fastest:319,gigue:[1e3,970,770],raccord:1e3,exigence:2}},{grid:`69377583`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgCCAk4KlAEYJN0BKLYBImY8YTT2Bzha`,ticks:306,entryTick:0,exitTick:299,exit:`course`,fastest:299,gigue:[990,755,450],raccord:null,exigence:3},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MgRyCIICMDTVARjOASJmTRpBLtoCJkIgigU`,ticks:294,entryTick:17,exitTick:287,exit:`course`,fastest:269,gigue:[920,510,225],raccord:1e3,exigence:4},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MghaXIkBzQIa1gESZk0YRYYIKFo`,ticks:287,entryTick:11,exitTick:280,exit:`course`,fastest:269,gigue:[1e3,725,440],raccord:1e3,exigence:3}}]},"cheminee-scie":{variants:[{grid:`205ff16a`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MADCA94BCh4cTUwapgESHhS1AQpGmgImggImogIoWg`,ticks:296,entryTick:0,exitTick:289,exit:`course`,fastest:289,gigue:[695,385,180],raccord:null,exigence:5},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MARyCPoB3gEKHiRFTBKuAQoeJG16RqICJuIECEo`,ticks:291,entryTick:17,exitTick:284,exit:`course`,fastest:266,gigue:[950,635,275],raccord:1e3,exigence:3},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MAjKAVYKhgEaHnUwtgEINMUBCCyKAiaaBQhK`,ticks:267,entryTick:11,exitTick:260,exit:`course`,fastest:249,gigue:[570,175,60],raccord:1e3,exigence:5}},{grid:`725007d3`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQC6A14KlgE6RFU65gEKbnqGBjTGAQhK`,ticks:310,entryTick:0,exitTick:303,exit:`course`,fastest:303,gigue:[635,245,65],raccord:null,exigence:5},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQRyCIIC1gFaTm0RtgISfrIICBoISg`,ticks:311,entryTick:17,exitTick:304,exit:`course`,fastest:285,gigue:[1e3,950,685],raccord:1e3,exigence:2},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQjSAdYBKi5dEjWiAT6VAVAJFUZiIEWmBSRGCEo`,ticks:277,entryTick:11,exitTick:270,exit:`course`,fastest:259,gigue:[985,900,605],raccord:1e3,exigence:2}}]},"cheminee-vide":{variants:[{grid:`9273d9b2`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MADaAW6CApQBCl4IXAktNgouNQgs9gQISg`,ticks:232,entryTick:0,exitTick:225,exit:`course`,fastest:225,gigue:[995,995,945],raccord:null,exigence:1},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MARyCHLOAQmNATJmPTpMJQi6BAhK`,ticks:199,entryTick:17,exitTick:192,exit:`course`,fastest:172,gigue:[870,520,355],raccord:1e3,exigence:4},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MAha1gEiPS4KXjI1NgpewgFGKi6yAg`,ticks:175,entryTick:11,exitTick:168,exit:`course`,fastest:157,gigue:[1e3,935,725],raccord:1e3,exigence:2}},{grid:`e61c696d`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQCSAmaqAl4VhAEhJY4CCk5NYCTGBQhK`,ticks:286,entryTick:0,exitTick:279,exit:`course`,fastest:279,gigue:[1e3,995,930],raccord:null,exigence:1},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQRyCHLGARK2ASI9PjViNXYgwgE2igM`,ticks:216,entryTick:17,exitTick:210,exit:`course`,fastest:193,gigue:[890,520,340],raccord:1e3,exigence:4},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MQhiJj12Gp4BMj1mKTVmNcIBNAgq9gE0ag`,ticks:198,entryTick:11,exitTick:192,exit:`course`,fastest:181,gigue:[680,325,170],raccord:1e3,exigence:5}},{grid:`46b25800`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MgDCAWaaApwBCl4IbAkdZAk1XgpOFLoBZvoBCGo`,ticks:242,entryTick:0,exitTick:235,exit:`course`,fastest:235,gigue:[1e3,885,770],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MgRyCHLGAQpeCh5kCn4KHkQhZiXCAyBCCEo`,ticks:207,entryTick:17,exitTick:200,exit:`course`,fastest:181,gigue:[900,625,405],raccord:1e3,exigence:3},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MghaVl0KXgo2ZAp-Ci5UEbYBggMgQghK`,ticks:189,entryTick:11,exitTick:182,exit:`course`,fastest:169,gigue:[975,655,465],raccord:1e3,exigence:3}},{grid:`b1abc18e`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MwAipgIhDI4DMoYDCBrGBAoeggUIQg`,ticks:317,entryTick:0,exitTick:310,exit:`course`,fastest:308,gigue:[1e3,995,960],raccord:null,exigence:1},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6MwRyCHLGARGNATJ-JTJULboECEo`,ticks:199,entryTick:17,exitTick:192,exit:`course`,fastest:172,gigue:[890,495,390],raccord:1e3,exigence:4},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6Mwha5gESZRJeKj0uCl7CAWYKLrIC`,ticks:175,entryTick:11,exitTick:168,exit:`course`,fastest:157,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`483d871a`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NADyAW7aAl5NNCElpgEKTlUmISCGAeIECEo`,ticks:274,entryTick:0,exitTick:267,exit:`course`,fastest:267,gigue:[1e3,1e3,900],raccord:null,exigence:1},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NARyCHK-ARKOAQouZGGWAdIBVvoC`,ticks:202,entryTick:17,exitTick:196,exit:`course`,fastest:179,gigue:[885,645,355],raccord:1e3,exigence:3},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NAhiPn0KlgESVDUyNa4CGnaCAw`,ticks:185,entryTick:11,exitTick:178,exit:`course`,fastest:167,gigue:[1e3,635,445],raccord:1e3,exigence:3}},{grid:`785c1e21`,arret:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NQDKAXaSApQBKpYBMmUIXMYECEo`,ticks:226,entryTick:0,exitTick:219,exit:`course`,fastest:215,gigue:[1e3,1e3,925],raccord:null,exigence:1},course:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NQRyCHLGAQq2AQpkCS02NbYDNGYISg`,ticks:189,entryTick:17,exitTick:182,exit:`course`,fastest:163,gigue:[915,695,470],raccord:1e3,exigence:3},plein:{code:`AQQWbW9kdWxlOmNoZW1pbmVlLXZpZGU6NQhiPo0BKpYBMmUJLTbCATYy9gEIag`,ticks:169,entryTick:11,exitTick:162,exit:`course`,fastest:151,gigue:[1e3,995,955],raccord:1e3,exigence:1}}]},cheminee:{variants:[{grid:`4bd534e7`,arret:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjAAugNeCg51EDRNCnQILGUKXjHCAVayBQhK`,ticks:280,entryTick:0,exitTick:273,exit:`course`,fastest:273,gigue:[700,390,130],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjAEcgjyAV4KZgomZAkdXgpmER5VJroBbko0jgIkhgIkJlo`,ticks:272,entryTick:17,exitTick:265,exit:`course`,fastest:244,gigue:[720,370,275],raccord:1e3,exigence:5},plein:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjAI0gG2AQoWZCFmEhaEASJkLoICHuIEIEIISg`,ticks:253,entryTick:11,exitTick:246,exit:`course`,fastest:235,gigue:[995,900,620],raccord:1e3,exigence:2}},{grid:`33488765`,arret:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjEAugPGARp0NTCWASFmRTQxtgGCAjbSAjYI8gI`,ticks:317,entryTick:0,exitTick:310,exit:`course`,fastest:306,gigue:[690,555,435],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjEEcgjyAeYBCg40RUQargEKHiSNAQp-8gGuA4IDCEo`,ticks:303,entryTick:17,exitTick:296,exit:`course`,fastest:279,gigue:[885,660,485],raccord:1e3,exigence:3},plein:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjEI0gGuAQoOfCBdpgEahAEpIkVm4gFGIiBBogImogM`,ticks:291,entryTick:11,exitTick:284,exit:`course`,fastest:273,gigue:[840,460,175],raccord:1e3,exigence:4}},{grid:`2a4d0379`,arret:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjIAwgPmAQoeJEVEIqYBCh4khQEKfqIICEI`,ticks:313,entryTick:0,exitTick:306,exit:`course`,fastest:306,gigue:[1e3,765,535],raccord:null,exigence:3},course:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjIEcgjyAeYBCh4kRUwapgEKHiSFAQp-oggIQg`,ticks:302,entryTick:17,exitTick:295,exit:`course`,fastest:278,gigue:[855,700,410],raccord:1e3,exigence:3},plein:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjII0gGuAQoeZChdpgEKHowBQRolbuIHGGI`,ticks:287,entryTick:11,exitTick:280,exit:`course`,fastest:270,gigue:[895,630,290],raccord:1e3,exigence:3}},{grid:`7ac96d5f`,arret:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjMAugNeCi4KLjUKXgktRAh8CCw1CCw2CFwILDbqAW7CAWYIGtYBNGYISg`,ticks:310,entryTick:0,exitTick:303,exit:`course`,fastest:301,gigue:[560,255,160],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjMEcgjyAV4KZgoeZAkdZgoeZAkdZgoeRCUKHiQlJtICNuIBJqICIFo`,ticks:296,entryTick:17,exitTick:289,exit:`course`,fastest:273,gigue:[750,300,135],raccord:1e3,exigence:5},plein:{code:`AQQRbW9kdWxlOmNoZW1pbmVlOjMI2gGuAQoeVBEddgoOZCB2IlYkJQk9RuICrgKiAhhi`,ticks:283,entryTick:11,exitTick:276,exit:`course`,fastest:265,gigue:[965,945,905],raccord:1e3,exigence:1}}]},"chute-pics":{variants:[{grid:`fca5c7ac`,arret:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MACiASaCASBBwgEgoQLAAeICJIIDCEo`,ticks:246,entryTick:0,exitTick:239,exit:`course`,fastest:239,gigue:[1e3,965,905],raccord:null,exigence:1},course:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MARyCDIWugHFARo4QdABIRjiAxyCAxBK`,ticks:243,entryTick:17,exitTick:236,exit:`course`,fastest:219,gigue:[845,650,625],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MAiqAyASwQHmAmGCBEC6AQ`,ticks:234,entryTick:11,exitTick:227,exit:`course`,fastest:216,gigue:[1e3,910,710],raccord:1e3,exigence:2}},{grid:`3e2b1c34`,arret:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MQCSATaCAWBClQHQAvYBMJIBNIIDCDo`,ticks:236,entryTick:0,exitTick:230,exit:`course`,fastest:230,gigue:[885,710,550],raccord:null,exigence:3},course:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MQRyCEoOigGhATqoATHYAbIFICIoGYIB`,ticks:241,entryTick:17,exitTick:234,exit:`course`,fastest:220,gigue:[780,545,380],raccord:1e3,exigence:5},plein:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MQiyAyjBAYYDIMIDQGIgSg`,ticks:224,entryTick:11,exitTick:217,exit:`course`,fastest:206,gigue:[1e3,930,845],raccord:1e3,exigence:2}},{grid:`19989458`,arret:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MgBiNuIDoQIyMfYBMGI0ggMISg`,ticks:238,entryTick:0,exitTick:231,exit:`course`,fastest:231,gigue:[765,730,660],raccord:null,exigence:2},course:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MgRyCBIW8gGlAWAZqAEhIMIBYOIBJIIDCEI`,ticks:238,entryTick:17,exitTick:231,exit:`course`,fastest:214,gigue:[990,925,795],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6Mgi6ASCCAakCStABxgEoogEUigMISg`,ticks:225,entryTick:11,exitTick:218,exit:`course`,fastest:207,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`2200b1dc`,arret:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MwBiNuIDoQIyMTI4mgLWAmEIigE`,ticks:246,entryTick:0,exitTick:239,exit:`course`,fastest:239,gigue:[995,940,820],raccord:null,exigence:2},course:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MwRyCBImygHFARowScgBISCCA-YDCBoISg`,ticks:243,entryTick:17,exitTick:236,exit:`course`,fastest:219,gigue:[815,680,545],raccord:1e3,exigence:3},plein:{code:`AQQTbW9kdWxlOmNodXRlLXBpY3M6MwjaAUg6GEFogQLiAiAqHsoE`,ticks:228,entryTick:11,exitTick:221,exit:`course`,fastest:210,gigue:[1e3,935,870],raccord:1e3,exigence:2}}]},corniches:{variants:[{grid:`fd953b95`,arret:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczowAOoBZooDlgHCCghK`,ticks:286,entryTick:0,exitTick:279,exit:`course`,fastest:274,gigue:[1e3,1e3,960],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczowBHIIGmaqA5YBsgoICghC`,ticks:278,entryTick:17,exitTick:271,exit:`course`,fastest:254,gigue:[1e3,990,850],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczowCFrmCUI`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a6e04ff6`,arret:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczoxAOoBZtoCZrIMMGIIQg`,ticks:321,entryTick:0,exitTick:315,exit:`course`,fastest:315,gigue:[1e3,1e3,835],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczoxBHIIGmb6AmbiDDha`,ticks:311,entryTick:17,exitTick:304,exit:`course`,fastest:283,gigue:[1e3,995,835],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczoxCJIBzgsq`,ticks:208,entryTick:11,exitTick:204,exit:`plein`,fastest:193,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`d4aff602`,arret:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczoyAOIBZpIDlgHCCghK`,ticks:286,entryTick:0,exitTick:279,exit:`course`,fastest:274,gigue:[1e3,1e3,905],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczoyBHIIMmaSA5YBsgoICghC`,ticks:278,entryTick:17,exitTick:271,exit:`course`,fastest:254,gigue:[1e3,1e3,925],raccord:1e3,exigence:1},plein:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczoyCFrmCUI`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0b3041f6`,arret:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczozAMoBbvoCXoIMYWIIQg`,ticks:321,entryTick:0,exitTick:315,exit:`course`,fastest:313,gigue:[1e3,950,825],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczozBHIIMlbSAmb6DChK`,ticks:306,entryTick:17,exitTick:299,exit:`course`,fastest:282,gigue:[1e3,865,675],raccord:960,exigence:2},plein:{code:`AQQSbW9kdWxlOmNvcm5pY2hlczozCFpGsgHOAfoCXqIF`,ticks:208,entryTick:11,exitTick:204,exit:`plein`,fastest:193,gigue:[910,785,705],raccord:1e3,exigence:2}}]},"demi-tour":{variants:[{grid:`545deeae`,arret:{code:`AQQSbW9kdWxlOmRlbWktdG91cjowACLGAgreBCLGBwhC`,ticks:253,entryTick:0,exitTick:246,exit:`course`,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmRlbWktdG91cjowBHIIEi6dAQqWAYoEtgYIWghK`,ticks:249,entryTick:17,exitTick:242,exit:`course`,fastest:225,gigue:[1e3,915,690],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmRlbWktdG91cjowCOoBxQEYlAKKAWaCBghaCEo`,ticks:237,entryTick:11,exitTick:230,exit:`course`,fastest:218,gigue:[625,295,135],raccord:1e3,exigence:5}},{grid:`d8011005`,arret:{code:`AQQSbW9kdWxlOmRlbWktdG91cjoxACLGAgreBCKGCAhK`,ticks:262,entryTick:0,exitTick:255,exit:`course`,fastest:255,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmRlbWktdG91cjoxBHIIEjaVAQqOAZIElgcweg`,ticks:260,entryTick:17,exitTick:253,exit:`course`,fastest:236,gigue:[1e3,935,590],raccord:1e3,exigence:3},plein:{code:`AQQSbW9kdWxlOmRlbWktdG91cjoxCLoBflUSpgIKfuoGCEI`,ticks:220,entryTick:11,exitTick:213,exit:`course`,fastest:203,gigue:[730,385,270],raccord:1e3,exigence:5}},{grid:`5912db5a`,arret:{code:`AQQSbW9kdWxlOmRlbWktdG91cjoyAIIBvgESpgGyA74HCCoIWghK`,ticks:262,entryTick:0,exitTick:255,exit:`course`,fastest:255,gigue:[1e3,1e3,970],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmRlbWktdG91cjoyBHIIEn1-Et4ESq4BmgYISg`,ticks:263,entryTick:17,exitTick:256,exit:`course`,fastest:239,gigue:[1e3,980,825],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmRlbWktdG91cjoyCLoBfk0ipgISbjL-BQg6CEo`,ticks:221,entryTick:11,exitTick:214,exit:`course`,fastest:203,gigue:[625,320,145],raccord:1e3,exigence:5}},{grid:`16421e95`,arret:{code:`AQQSbW9kdWxlOmRlbWktdG91cjozAIoBrgEqjgQylgQK7gcIOg`,ticks:314,entryTick:0,exitTick:308,exit:`course`,fastest:308,gigue:[1e3,1e3,955],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmRlbWktdG91cjozBHIIGi6NARKuBBqOBDLGBwhC`,ticks:314,entryTick:17,exitTick:307,exit:`course`,fastest:290,gigue:[1e3,880,670],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmRlbWktdG91cjozCLoBhgFVCqYCKoYHCDoISg`,ticks:221,entryTick:11,exitTick:214,exit:`course`,fastest:203,gigue:[565,335,115],raccord:1e3,exigence:5}}]},"descente-scies":{variants:[{grid:`6b172cab`,arret:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAAiggmugUeqgVekgUe4gU`,ticks:496,entryTick:0,exitTick:492,exit:`plein`,fastest:492,gigue:[950,825,780],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAEcgjKBjbaBRaSBVbKBQ7SBQ`,ticks:491,entryTick:17,exitTick:487,exit:`plein`,fastest:471,gigue:[970,900,680],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjAI2gNGygQ2qgQWkgU2ugY`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,855,655],raccord:1e3,exigence:2}},{grid:`9c444faf`,arret:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEAiggmmgYmogUmggUmugU`,ticks:495,entryTick:0,exitTick:491,exit:`plein`,fastest:491,gigue:[1e3,915,780],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEEcgjKBjaaBi6SBS7yBFbCBQ`,ticks:493,entryTick:17,exitTick:489,exit:`plein`,fastest:472,gigue:[1e3,985,845],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjEIqgM2ggUumgSmA8IENpoE`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,1e3,940],raccord:1e3,exigence:1}},{grid:`29b6d51b`,arret:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIAiggumgYWqgUmigUOygU`,ticks:495,entryTick:0,exitTick:490,exit:`plein`,fastest:491,gigue:[990,895,700],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIEcgjCBj6iBg6iBTaKBRbSBQ`,ticks:490,entryTick:17,exitTick:485,exit:`plein`,fastest:472,gigue:[1e3,980,735],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjIIggQekgQW0gVWogQmqgY`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,980,980],raccord:1e3,exigence:1}},{grid:`37a304ab`,arret:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjMAkggmmgYeogUm8gQ2ugU`,ticks:495,entryTick:0,exitTick:491,exit:`plein`,fastest:491,gigue:[1e3,945,905],raccord:null,exigence:1},course:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjMEcgiqBk6KBi6qBS6CBSbiBQ`,ticks:493,entryTick:17,exitTick:489,exit:`plein`,fastest:472,gigue:[1e3,995,810],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjMIqgM2wgUe6gMmogU2ugY`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,895,810],raccord:1e3,exigence:2}},{grid:`3662e5f7`,arret:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQAkggmkgYmqgUW-gQ2ugU`,ticks:495,entryTick:0,exitTick:491,exit:`plein`,fastest:491,gigue:[1e3,1e3,920],raccord:null,exigence:1},course:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQEcgjCBjaCBjaqBS7yBDbaBQ`,ticks:492,entryTick:17,exitTick:488,exit:`plein`,fastest:472,gigue:[1e3,940,805],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjQIqgM2ggUukgSuA8IEPpIE`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`5623db4b`,arret:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUAmggesgUeqgVemgUW6gU`,ticks:497,entryTick:0,exitTick:492,exit:`plein`,fastest:492,gigue:[960,880,875],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUEcgjKBjbaBSb6BD7yBR7KBQ`,ticks:493,entryTick:17,exitTick:488,exit:`plein`,fastest:471,gigue:[995,895,730],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmRlc2NlbnRlLXNjaWVzOjUI2gM-wgRGmgQemgU2ugY`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,995,655],raccord:1e3,exigence:2}}]},descente:{variants:[{grid:`13f78d09`,arret:{code:`AQQRbW9kdWxlOmRlc2NlbnRlOjAAggcm4gUmwgZAag`,ticks:337,entryTick:0,exitTick:330,exit:`course`,fastest:330,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOmRlc2NlbnRlOjAEcgi6BR6KBibaBihK`,ticks:327,entryTick:17,exitTick:320,exit:`course`,fastest:303,gigue:[1e3,990,950],raccord:920,exigence:1},plein:{code:`AQQRbW9kdWxlOmRlc2NlbnRlOjAIWk6CBB7qCA`,ticks:228,entryTick:11,exitTick:224,exit:`plein`,fastest:213,gigue:[1e3,970,785],raccord:1e3,exigence:2}},{grid:`73703410`,arret:{code:`AQQRbW9kdWxlOmRlc2NlbnRlOjEAwgQ20gU28gcxeg`,ticks:321,entryTick:0,exitTick:314,exit:`course`,fastest:311,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOmRlc2NlbnRlOjEEcgiaAx6CByaCByEIQg`,ticks:310,entryTick:17,exitTick:304,exit:`course`,fastest:287,gigue:[1e3,1e3,905],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOmRlc2NlbnRlOjEIWo4KYZoB`,ticks:203,entryTick:11,exitTick:196,exit:`course`,fastest:185,gigue:[1e3,785,685],raccord:960,exigence:2}}]},"elan-friable":{variants:[{grid:`57a612ea`,arret:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTowAKIJhgHCBa4GSg`,ticks:362,entryTick:0,exitTick:357,exit:`plein`,fastest:357,gigue:[1e3,1e3,950],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTowBHIIkgiGAZIFpgZS`,ticks:353,entryTick:17,exitTick:349,exit:`plein`,fastest:332,gigue:[1e3,1e3,980],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTowCNIGbroFlgZa`,ticks:315,entryTick:11,exitTick:311,exit:`plein`,fastest:300,gigue:[1e3,1e3,890],raccord:1e3,exigence:2}},{grid:`7454c9bc`,arret:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZToxAPoJjgYa7gY6`,ticks:375,entryTick:0,exitTick:371,exit:`plein`,fastest:371,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZToxBHIIugieAYoF_gYq`,ticks:366,entryTick:17,exitTick:362,exit:`plein`,fastest:345,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZToxCPoGhgGyBe4GMg`,ticks:328,entryTick:11,exitTick:324,exit:`plein`,fastest:313,gigue:[1e3,1e3,895],raccord:1e3,exigence:2}},{grid:`79bf9f06`,arret:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZToyANoJngHaBY4HUg`,ticks:388,entryTick:0,exitTick:384,exit:`plein`,fastest:384,gigue:[1e3,1e3,935],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZToyBHIIwgimAboFngc6`,ticks:380,entryTick:17,exitTick:375,exit:`plein`,fastest:358,gigue:[1e3,995,880],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZToyCIIHngGaBaYB4gY`,ticks:342,entryTick:11,exitTick:337,exit:`plein`,fastest:326,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`baadc28a`,arret:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTozAJoJjgHKBa4GQg`,ticks:362,entryTick:0,exitTick:357,exit:`plein`,fastest:357,gigue:[1e3,1e3,805],raccord:null,exigence:2},course:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTozBHIIkgh-ogWmBko`,ticks:353,entryTick:17,exitTick:349,exit:`plein`,fastest:332,gigue:[1e3,1e3,950],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTozCNIGbroFlgZa`,ticks:315,entryTick:11,exitTick:311,exit:`plein`,fastest:300,gigue:[1e3,1e3,905],raccord:1e3,exigence:1}},{grid:`03ae8d44`,arret:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTo0APoJjgYa7gY6`,ticks:375,entryTick:0,exitTick:371,exit:`plein`,fastest:371,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTo0BHIIygh2mgWGByo`,ticks:366,entryTick:17,exitTick:362,exit:`plein`,fastest:345,gigue:[1e3,950,795],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTo0CPIGhgGyBfYGMg`,ticks:328,entryTick:11,exitTick:324,exit:`plein`,fastest:313,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`c80d1896`,arret:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTo1APoJfqoFXsoG`,ticks:375,entryTick:0,exitTick:371,exit:`plein`,fastest:371,gigue:[1e3,1e3,980],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTo1BHIIugiOAZIFVtoG`,ticks:366,entryTick:17,exitTick:362,exit:`plein`,fastest:345,gigue:[1e3,1e3,910],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOmVsYW4tZnJpYWJsZTo1COIGhgGqBV7iBg`,ticks:328,entryTick:11,exitTick:324,exit:`plein`,fastest:313,gigue:[1e3,1e3,905],raccord:1e3,exigence:1}}]},"elan-mur":{variants:[{grid:`55306d43`,arret:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjAA-gmOBio`,ticks:261,entryTick:0,exitTick:257,exit:`plein`,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjAEcgiyCIYGQg`,ticks:253,entryTick:17,exitTick:249,exit:`plein`,fastest:232,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjAI-gaGBkI`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`786a0280`,arret:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjEA-gmuBkI`,ticks:268,entryTick:0,exitTick:264,exit:`plein`,fastest:264,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjEEcgiyCMYGMg`,ticks:259,entryTick:17,exitTick:255,exit:`plein`,fastest:238,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjEI-gbGBjI`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`898aaaa0`,arret:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjIA-gmuBkI`,ticks:268,entryTick:0,exitTick:264,exit:`plein`,fastest:264,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjIEcgiyCMYGMg`,ticks:259,entryTick:17,exitTick:255,exit:`plein`,fastest:238,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjII-gbGBjI`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`e7f35d93`,arret:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjMA-gmOBio`,ticks:261,entryTick:0,exitTick:257,exit:`plein`,fastest:257,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjMEcgiyCIYGQg`,ticks:253,entryTick:17,exitTick:249,exit:`plein`,fastest:232,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOmVsYW4tbXVyOjMI-gaGBkI`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"elan-plafond":{variants:[{grid:`6c472241`,arret:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDowAOIJxgMixgMixgQ6`,ticks:355,entryTick:0,exitTick:351,exit:`plein`,fastest:351,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDowBHIIsgi2AyrWAwrWBCo`,ticks:346,entryTick:17,exitTick:342,exit:`plein`,fastest:325,gigue:[1e3,920,830],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDowCPoGrgMivgMi5gQq`,ticks:308,entryTick:11,exitTick:304,exit:`plein`,fastest:293,gigue:[1e3,1e3,935],raccord:1e3,exigence:1}},{grid:`bc71f914`,arret:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDoxAKIJxgMixgMixgRC`,ticks:348,entryTick:0,exitTick:344,exit:`plein`,fastest:344,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDoxBHII-gfOAxLGAyLGBDI`,ticks:339,entryTick:17,exitTick:335,exit:`plein`,fastest:318,gigue:[1e3,935,795],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDoxCKoGtgMytgMyxgRK`,ticks:302,entryTick:11,exitTick:297,exit:`plein`,fastest:286,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`2b431029`,arret:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDoyAOIJxgMipgg6`,ticks:355,entryTick:0,exitTick:351,exit:`plein`,fastest:351,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDoyBHIIugjOAxrmAQoO0gY`,ticks:346,entryTick:17,exitTick:342,exit:`plein`,fastest:325,gigue:[995,925,815],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDoyCPoGzgMi3gESFsoG`,ticks:308,entryTick:11,exitTick:304,exit:`plein`,fastest:293,gigue:[1e3,915,910],raccord:1e3,exigence:1}},{grid:`b469476f`,arret:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDozAIIK_gMa_gMi3gQ6`,ticks:375,entryTick:0,exitTick:371,exit:`plein`,fastest:371,gigue:[1e3,1e3,565],raccord:null,exigence:3},course:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDozBHIIygiGBBL-AyLmBCo`,ticks:366,entryTick:17,exitTick:362,exit:`plein`,fastest:345,gigue:[960,795,480],raccord:1e3,exigence:3},plein:{code:`AQQVbW9kdWxlOmVsYW4tcGxhZm9uZDozCIIH_gMilgQK7gQq`,ticks:328,entryTick:11,exitTick:324,exit:`plein`,fastest:313,gigue:[1e3,1e3,760],raccord:1e3,exigence:2}}]},"elan-scie":{variants:[{grid:`3f75d235`,arret:{code:`AQQSbW9kdWxlOmVsYW4tc2NpZTowAKoJ9gZK`,ticks:268,entryTick:0,exitTick:264,exit:`plein`,fastest:264,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmVsYW4tc2NpZTowBHII6gf2Bko`,ticks:259,entryTick:17,exitTick:255,exit:`plein`,fastest:238,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQSbW9kdWxlOmVsYW4tc2NpZTowCNoGXroG`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[725,450,285],raccord:1e3,exigence:5}},{grid:`a78ed235`,arret:{code:`AQQSbW9kdWxlOmVsYW4tc2NpZToxALIJrgdC`,ticks:275,entryTick:0,exitTick:271,exit:`plein`,fastest:271,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmVsYW4tc2NpZToxBHIIggiuBzI`,ticks:266,entryTick:17,exitTick:262,exit:`plein`,fastest:245,gigue:[1e3,975,865],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmVsYW4tc2NpZToxCNIGZuoDrgH6AybiAghC`,ticks:320,entryTick:11,exitTick:313,exit:`course`,fastest:297,gigue:[1e3,845,620],raccord:1e3,exigence:2}}]},"elan-traversee":{variants:[{grid:`98775de9`,arret:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjAA8gi-AdIDrgHKBp4Bsgde2gJO6gJOogM`,ticks:655,entryTick:0,exitTick:651,exit:`plein`,fastest:651,gigue:[1e3,985,740],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjAEcgjKB74BqgPWAcIGngGqBz7qAj76AlaqAw`,ticks:647,entryTick:17,exitTick:642,exit:`plein`,fastest:625,gigue:[980,735,600],raccord:1e3,exigence:2},plein:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjAIWo4BggSeBRqWAfIGngH6Bv4CIqYDIuYDKg`,ticks:608,entryTick:11,exitTick:604,exit:`plein`,fastest:593,gigue:[1e3,1e3,885],raccord:1e3,exigence:2}},{grid:`f87434d0`,arret:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjEA-giOAaoDxgHiBo4BsgdOmgNOmgNO2gM`,ticks:668,entryTick:0,exitTick:664,exit:`plein`,fastest:664,gigue:[1e3,815,425],raccord:null,exigence:3},course:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjEEcgjKB4YBsgOuAcIGtgG6Bz6qAz6qAz7qAw`,ticks:660,entryTick:17,exitTick:656,exit:`plein`,fastest:639,gigue:[840,495,270],raccord:1e3,exigence:4},plein:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjEIcn66A94B0gP2ByL-BwrGAyLGAyqeBDo`,ticks:622,entryTick:11,exitTick:618,exit:`plein`,fastest:607,gigue:[1e3,1e3,870],raccord:1e3,exigence:2}},{grid:`4fae246d`,arret:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjIAigmmAdIDrgGqBtYB0gdG6gJe2gJOqgM`,ticks:662,entryTick:0,exitTick:658,exit:`plein`,fastest:658,gigue:[1e3,915,600],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjIEcgjqB54BqgPOAdoG1gGSB1bqAjbyAkayAw`,ticks:653,entryTick:17,exitTick:649,exit:`plein`,fastest:632,gigue:[1e3,775,535],raccord:1e3,exigence:3},plein:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjIIWpYB8gOmBRqWAfoGXuoD7ggi3gMi9gISpgQq`,ticks:708,entryTick:11,exitTick:704,exit:`plein`,fastest:693,gigue:[895,615,320],raccord:1e3,exigence:3}},{grid:`baf008c9`,arret:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjMA8gi-AdoDngG6Bq4Bugde0gJW4gJWogM`,ticks:655,entryTick:0,exitTick:651,exit:`plein`,fastest:651,gigue:[1e3,960,755],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjMEcgjaB6YBsgPmAcIGlgGiBz76Aj7qAlaiAw`,ticks:646,entryTick:17,exitTick:642,exit:`plein`,fastest:625,gigue:[965,770,505],raccord:1e3,exigence:3},plein:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjMIWo4BggSeBRKmAeoGlgH6BoYDIqYDIuYDKg`,ticks:608,entryTick:11,exitTick:604,exit:`plein`,fastest:593,gigue:[1e3,1e3,915],raccord:1e3,exigence:1}},{grid:`f5f410a4`,arret:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjQA8gieAboD5gGSBq4BqgdOmgNOkgMemgQ`,ticks:669,entryTick:0,exitTick:664,exit:`plein`,fastest:664,gigue:[1e3,1e3,810],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjQEcgiSATaCBzE67gYKvgMKngMKXoIDxgsijgGCB74DOv4DEh6KBA`,ticks:953,entryTick:17,exitTick:949,exit:`plein`,fastest:932,gigue:[635,240,70],raccord:1e3,exigence:5},plein:{code:`AQQXbW9kdWxlOmVsYW4tdHJhdmVyc2VlOjQIqgXOAdID_gci9gcS1gMShgQiJvoD`,ticks:622,entryTick:11,exitTick:618,exit:`plein`,fastest:607,gigue:[1e3,780,595],raccord:1e3,exigence:3}}]},"escalier-friable":{variants:[{grid:`1be7cff6`,arret:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MADCAZ4B-gJmqgJe-gG-BDKWAWIwMWI0-gI`,ticks:365,entryTick:0,exitTick:358,exit:`course`,fastest:354,gigue:[895,770,540],raccord:null,exigence:3},course:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MARyCBJmsgJ2igNG2gHGBBJ-2gIlIaICKEo`,ticks:355,entryTick:17,exitTick:348,exit:`course`,fastest:331,gigue:[635,385,150],raccord:1e3,exigence:5},plein:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MAiSAe4DKv4CMsYEMg`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,880],raccord:1e3,exigence:2}},{grid:`265c9667`,arret:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQDKAV6yAl6qAk7yAVaiAl7yASUpQv4CCEo`,ticks:322,entryTick:0,exitTick:315,exit:`course`,fastest:315,gigue:[535,220,135],raccord:null,exigence:5},course:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQRyCBJewgJOggJe6gGOAdoCZoICJoICQGI`,ticks:309,entryTick:17,exitTick:302,exit:`course`,fastest:285,gigue:[810,395,220],raccord:960,exigence:4},plein:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQha3gGKAY4B2gGmBSo`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[555,305,195],raccord:1e3,exigence:5}},{grid:`ea4fafd2`,arret:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgDiAWbCAoYBggNW4gJWwgRG4gJASg`,ticks:349,entryTick:0,exitTick:342,exit:`course`,fastest:342,gigue:[1e3,885,640],raccord:null,exigence:2},course:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgRyCBKGAYIDRuIBhgGiA2bSBCbSAwhK`,ticks:343,entryTick:17,exitTick:336,exit:`course`,fastest:319,gigue:[825,515,270],raccord:1e3,exigence:4},plein:{code:`AQQZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MgiSAfYDKvYCCi7yBA`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"grand-saut":{variants:[{grid:`b9b54df5`,arret:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MACKCd4BsgXGAYoH`,ticks:395,entryTick:0,exitTick:391,exit:`plein`,fastest:391,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MARyCIoIrgYipggq`,ticks:386,entryTick:17,exitTick:382,exit:`plein`,fastest:365,gigue:[1e3,990,865],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MAjSBq4GIqYIKg`,ticks:348,entryTick:11,exitTick:344,exit:`plein`,fastest:333,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`afc1625d`,arret:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MQD6Cc4GEq4Bmgc`,ticks:402,entryTick:0,exitTick:397,exit:`plein`,fastest:397,gigue:[1e3,960,865],raccord:null,exigence:2},course:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MQRyCMIIvgH6BKYIQg`,ticks:393,entryTick:17,exitTick:389,exit:`plein`,fastest:372,gigue:[1e3,985,840],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MQiCB7YGKoYIQg`,ticks:355,entryTick:11,exitTick:351,exit:`plein`,fastest:340,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`16026ee5`,arret:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MgCKCdYBwgWGAcIH`,ticks:395,entryTick:0,exitTick:391,exit:`plein`,fastest:391,gigue:[1e3,1e3,935],raccord:null,exigence:1},course:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MgRyCJIIpgYyhgG6Bw`,ticks:386,entryTick:17,exitTick:382,exit:`plein`,fastest:365,gigue:[1e3,960,800],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MgjKBq4BqgWGAcoH`,ticks:348,entryTick:11,exitTick:344,exit:`plein`,fastest:333,gigue:[1e3,1e3,860],raccord:1e3,exigence:2}},{grid:`94c2ed31`,arret:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MwCCCuYGIsYIOg`,ticks:415,entryTick:0,exitTick:411,exit:`plein`,fastest:411,gigue:[1e3,1e3,885],raccord:null,exigence:2},course:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MwRyCMII3gGyBd4Bmgc`,ticks:406,entryTick:17,exitTick:402,exit:`plein`,fastest:385,gigue:[1e3,840,685],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOmdyYW5kLXNhdXQ6MwiCB_YGIs4IKg`,ticks:368,entryTick:11,exitTick:364,exit:`plein`,fastest:353,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"grande-scie":{variants:[{grid:`42f0de9f`,arret:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjAA6gMmqgQO6gMoWg`,ticks:212,entryTick:0,exitTick:205,exit:`course`,fastest:205,gigue:[910,595,405],raccord:null,exigence:4},course:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjAEcgiaAibCBB6CBAhK`,ticks:203,entryTick:17,exitTick:196,exit:`course`,fastest:179,gigue:[875,630,325],raccord:1e3,exigence:3},plein:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjAIygEOqgIm6gM`,ticks:128,entryTick:11,exitTick:124,exit:`plein`,fastest:113,gigue:[975,870,780],raccord:1e3,exigence:2}},{grid:`172d8193`,arret:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjEA4gMWmgUm8gMQSg`,ticks:222,entryTick:0,exitTick:216,exit:`course`,fastest:219,gigue:[580,405,230],raccord:null,exigence:5},course:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjEEcgiSAg7SAxCiAQ6iAjbCAigaCFo`,ticks:233,entryTick:17,exitTick:226,exit:`course`,fastest:209,gigue:[1e3,765,545],raccord:1e3,exigence:3},plein:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjEIggIOqgIOsgQ`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,950,870],raccord:1e3,exigence:2}},{grid:`b4e442e4`,arret:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjIA6gMWqgImwgMmwgImggJBCBoIeg`,ticks:268,entryTick:0,exitTick:261,exit:`course`,fastest:261,gigue:[570,140,55],raccord:null,exigence:5},course:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjIEcgiiAh7aBR6iBChC`,ticks:229,entryTick:17,exitTick:222,exit:`course`,fastest:205,gigue:[615,390,155],raccord:1e3,exigence:5},plein:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjIIggEO6gMO4gQ`,ticks:155,entryTick:11,exitTick:151,exit:`plein`,fastest:140,gigue:[1e3,775,590],raccord:1e3,exigence:3}},{grid:`ccac0a33`,arret:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjMA6gMWigUWggQYSg`,ticks:222,entryTick:0,exitTick:215,exit:`course`,fastest:219,gigue:[905,460,335],raccord:null,exigence:4},course:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjMEcgiKAh6qBRb6AyhK`,ticks:215,entryTick:17,exitTick:208,exit:`course`,fastest:192,gigue:[660,395,350],raccord:960,exigence:5},plein:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjMIigIOogIOsgQ`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,980,770],raccord:1e3,exigence:2}},{grid:`aa3adf1f`,arret:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjQA4gMmsgQO6gMoUg`,ticks:211,entryTick:0,exitTick:205,exit:`course`,fastest:205,gigue:[940,670,510],raccord:null,exigence:3},course:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjQEcgiKAibaBCbyAwhK`,ticks:203,entryTick:17,exitTick:196,exit:`course`,fastest:179,gigue:[645,455,310],raccord:1e3,exigence:5},plein:{code:`AQQUbW9kdWxlOmdyYW5kZS1zY2llOjQIygEOsgIO-gM`,ticks:128,entryTick:11,exitTick:124,exit:`plein`,fastest:113,gigue:[1e3,950,835],raccord:1e3,exigence:2}}]},"iles-friables":{variants:[{grid:`6b0aa634`,arret:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MADCAWbSAt4BmgNWggOeAzUspgIIQg`,ticks:321,entryTick:0,exitTick:315,exit:`course`,fastest:311,gigue:[1e3,915,745],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MARyCBp2mgN2qgM-sgJFlgOCAwhK`,ticks:311,entryTick:17,exitTick:304,exit:`course`,fastest:285,gigue:[980,900,725],raccord:960,exigence:2},plein:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MAhapgUStgUq`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`095100b2`,arret:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQCCAc4FGmb6Au4EIma6Ay6iAiB6`,ticks:375,entryTick:0,exitTick:368,exit:`course`,fastest:368,gigue:[1e3,825,695],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQRyCBLWBTpesgJ2qgNO-gI-4gMIQg`,ticks:362,entryTick:17,exitTick:355,exit:`course`,fastest:338,gigue:[920,715,490],raccord:1e3,exigence:3},plein:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQhaNroCrgQypgUy`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,880,700],raccord:1e3,exigence:2}},{grid:`2dc14776`,arret:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MgDCAWbyApYBggNWggO2BghK`,ticks:318,entryTick:0,exitTick:311,exit:`course`,fastest:311,gigue:[990,860,700],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MgRyCBKOAboDRrIDPqoCRZYGCEo`,ticks:311,entryTick:17,exitTick:304,exit:`course`,fastest:285,gigue:[985,915,715],raccord:1e3,exigence:2},plein:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MghangUatgUq`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`45e40182`,arret:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwDiAe4EGmbyAu4EKma6Ay6iAiB6`,ticks:375,entryTick:0,exitTick:368,exit:`course`,fastest:368,gigue:[1e3,910,735],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwRyCBLmBDJGsgLmBCFEpgQgZqIBQUBCCFo`,ticks:373,entryTick:17,exitTick:366,exit:`course`,fastest:349,gigue:[645,475,340],raccord:1e3,exigence:5},plein:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MwhaRqoCtgQqpgUy`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,870,710],raccord:1e3,exigence:2}},{grid:`5bf44276`,arret:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NADSAaYBsgNemgM2ugNG6gQISg`,ticks:318,entryTick:0,exitTick:311,exit:`course`,fastest:311,gigue:[1e3,990,865],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NARyCBKGAZoDIC4k0gM26gIISh6KAW6CAyFa`,ticks:312,entryTick:17,exitTick:305,exit:`course`,fastest:288,gigue:[850,735,645],raccord:960,exigence:2},plein:{code:`AQQWbW9kdWxlOmlsZXMtZnJpYWJsZXM6NAhargH6AjaqAi6CAsYBKg`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[985,710,520],raccord:1e3,exigence:3}}]},"iles-scie":{variants:[{grid:`02ec991a`,arret:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTowALICJuICDvoDFqIDJoIEIEo`,ticks:285,entryTick:0,exitTick:278,exit:`course`,fastest:283,gigue:[1e3,1e3,995],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTowBHIIMi7qAib6Ax7SAhaCBSAiCEo`,ticks:283,entryTick:17,exitTick:276,exit:`course`,fastest:259,gigue:[995,965,870],raccord:920,exigence:2},plein:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTowCFpmogRG4gQ`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,920,805],raccord:1e3,exigence:2}},{grid:`930bf039`,arret:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZToxANIBLvIDHooEHqIDPvoEGEo`,ticks:314,entryTick:0,exitTick:307,exit:`course`,fastest:307,gigue:[1e3,1e3,950],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZToxBHIIMiayBDaCAyaqBCbaBAhS`,ticks:312,entryTick:17,exitTick:305,exit:`course`,fastest:285,gigue:[1e3,870,640],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZToxCOIBRuIDbrIF`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[1e3,1e3,870],raccord:1e3,exigence:2}},{grid:`98865c4d`,arret:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZToyAKoCHtICHoIEHqIDJoIEICIISg`,ticks:290,entryTick:0,exitTick:283,exit:`course`,fastest:283,gigue:[990,970,970],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZToyBHIIIh6KAy7qAybCAiaCBSAiCEo`,ticks:283,entryTick:17,exitTick:276,exit:`course`,fastest:259,gigue:[1e3,970,790],raccord:920,exigence:2},plein:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZToyCGJumgQu8gQ`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,965,780],raccord:1e3,exigence:2}},{grid:`93ed21f8`,arret:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTozAMoBLvoDHooEHpoDLoIFKEo`,ticks:314,entryTick:0,exitTick:307,exit:`course`,fastest:307,gigue:[1e3,950,810],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTozBHIIMiayBDaCAyaqBCbaBAhS`,ticks:312,entryTick:17,exitTick:305,exit:`course`,fastest:285,gigue:[1e3,785,650],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTozCIoBbqIDDqICTpoE`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[1e3,995,955],raccord:1e3,exigence:1}},{grid:`6b0a8533`,arret:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTo0AKoCFuoCHvIDHqIDJoIEICIISg`,ticks:290,entryTick:0,exitTick:283,exit:`course`,fastest:283,gigue:[1e3,1e3,960],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTo0BHIIOh7yAi7yAx7SAhaCBSAiCEo`,ticks:283,entryTick:17,exitTick:276,exit:`course`,fastest:259,gigue:[1e3,1e3,930],raccord:920,exigence:1},plein:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTo0CFpmogQ28gQ`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,1e3,835],raccord:1e3,exigence:2}},{grid:`37a940af`,arret:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTo1AKoCHtICFoIEJsICJoIFKGI`,ticks:293,entryTick:0,exitTick:286,exit:`course`,fastest:286,gigue:[900,930,880],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTo1BHIIGkbqAhaqAya6CChS`,ticks:280,entryTick:17,exitTick:273,exit:`course`,fastest:256,gigue:[920,850,800],raccord:920,exigence:2},plein:{code:`AQQSbW9kdWxlOmlsZXMtc2NpZTo1CGJWugM24gU`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,965,885],raccord:1e3,exigence:2}}]},lucarne:{variants:[{grid:`181480d2`,arret:{code:`AQQQbW9kdWxlOmx1Y2FybmU6MADSAUb6AkbSA27CBghC`,ticks:273,entryTick:0,exitTick:266,exit:`course`,fastest:266,gigue:[840,695,445],raccord:null,exigence:3},course:{code:`AQQQbW9kdWxlOmx1Y2FybmU6MARyCBpGqgJOigRWygYQQg`,ticks:262,entryTick:17,exitTick:255,exit:`course`,fastest:238,gigue:[825,600,340],raccord:1e3,exigence:3},plein:{code:`AQQQbW9kdWxlOmx1Y2FybmU6MAha5gMyRuIE`,ticks:161,entryTick:11,exitTick:157,exit:`plein`,fastest:146,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`ea4d366e`,arret:{code:`AQQQbW9kdWxlOmx1Y2FybmU6MQDSAU7yAkbaA0Yg5gJEhgMkJlo`,ticks:279,entryTick:0,exitTick:272,exit:`course`,fastest:272,gigue:[1e3,625,400],raccord:null,exigence:3},course:{code:`AQQQbW9kdWxlOmx1Y2FybmU6MQRyCBJGmgJWogM-4gcIQg`,ticks:262,entryTick:17,exitTick:255,exit:`course`,fastest:238,gigue:[560,190,90],raccord:1e3,exigence:5},plein:{code:`AQQQbW9kdWxlOmx1Y2FybmU6MQhahgGKAR6KAp4BugKmATWSAY4CJEYISg`,ticks:237,entryTick:11,exitTick:230,exit:`course`,fastest:219,gigue:[920,855,795],raccord:1e3,exigence:2}}]},marelle:{variants:[{grid:`131de9b2`,arret:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MADaARaKBVaKBkb6BCBK`,ticks:317,entryTick:0,exitTick:310,exit:`course`,fastest:310,gigue:[875,630,440],raccord:null,exigence:3},course:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MARyCFom2gRm-gauAcIDICIISg`,ticks:323,entryTick:17,exitTick:316,exit:`course`,fastest:299,gigue:[995,970,770],raccord:1e3,exigence:2},plein:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MAiCAaYBqgZmkgQ`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,945],raccord:1e3,exigence:1}},{grid:`59815a4c`,arret:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MQDyA5YBogU2ogYYGghK`,ticks:286,entryTick:0,exitTick:279,exit:`course`,fastest:279,gigue:[940,675,520],raccord:null,exigence:3},course:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MQRyCKoClgGyBTa6BggaCEI`,ticks:278,entryTick:17,exitTick:271,exit:`course`,fastest:255,gigue:[900,565,370],raccord:1e3,exigence:4},plein:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MQhangGaA166Bg`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}},{grid:`35414776`,arret:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MgDqARb6BFaKBkb6BCBK`,ticks:317,entryTick:0,exitTick:310,exit:`course`,fastest:310,gigue:[895,615,500],raccord:null,exigence:3},course:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MgRyCCImkgVm8gauAcoDICIISg`,ticks:323,entryTick:17,exitTick:316,exit:`course`,fastest:299,gigue:[1e3,985,800],raccord:1e3,exigence:2},plein:{code:`AQQQbW9kdWxlOm1hcmVsbGU6MghqtgGqBm6SBA`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"mur-friable":{variants:[{grid:`d54d4a80`,arret:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjAAkgRWCk4KVi0KNlwJTRYKrgGiAnayAwhC`,ticks:267,entryTick:0,exitTick:261,exit:`course`,fastest:261,gigue:[1e3,605,510],raccord:null,exigence:3},course:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjAEcghS7gEIngEKDmwKXgoehAEilgGKAh6yBAhK`,ticks:259,entryTick:17,exitTick:252,exit:`course`,fastest:235,gigue:[875,820,610],raccord:920,exigence:2},plein:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjAIggJWCkYKHjwtCl4KXiUJHWSKAh6CAiaiAiFi`,ticks:235,entryTick:11,exitTick:228,exit:`course`,fastest:217,gigue:[655,325,165],raccord:1e3,exigence:5}},{grid:`68a5b778`,arret:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjEAmgSOAQhMISU-CiZFCBxGImUKfkT6ASySBAhK`,ticks:286,entryTick:0,exitTick:279,exit:`course`,fastest:279,gigue:[1e3,965,710],raccord:null,exigence:2},course:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjEEcgjSAlwKZgoebBiGASKmAQk9RhWyAiaiBAhK`,ticks:279,entryTick:17,exitTick:272,exit:`course`,fastest:255,gigue:[785,470,235],raccord:1e3,exigence:5},plein:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjEIkgJmEiY9CCw-Gm0QTBYyZQktNvIBLvoBNtICCEo`,ticks:255,entryTick:11,exitTick:248,exit:`course`,fastest:237,gigue:[985,870,685],raccord:1e3,exigence:2}},{grid:`d880ca70`,arret:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjIAkgSOAQhkCS0-Ch5FCCRWEmUKbkyKAiSSBAhK`,ticks:286,entryTick:0,exitTick:279,exit:`course`,fastest:279,gigue:[1e3,780,635],raccord:null,exigence:2},course:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjIEcgjKAlYKfhIOZCCGASKEASpcJoICJoICJqICIFI`,ticks:279,entryTick:17,exitTick:272,exit:`course`,fastest:251,gigue:[955,480,215],raccord:1e3,exigence:4},plein:{code:`AQQUbW9kdWxlOm11ci1mcmlhYmxlOjIIkgJuCg5VCEw2EmUIXDJlCS028gE28gE20gIISg`,ticks:255,entryTick:11,exitTick:248,exit:`course`,fastest:237,gigue:[995,925,730],raccord:1e3,exigence:2}}]},"mur-seul":{variants:[{grid:`00ae395c`,arret:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjAAwgHGAgreAwr-AQq-BiBy`,ticks:278,entryTick:0,exitTick:271,exit:`course`,fastest:270,gigue:[1e3,1e3,985],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjAEcggS9gEw5gMy9gEKrgMyNmIwqgI`,ticks:270,entryTick:17,exitTick:263,exit:`course`,fastest:246,gigue:[1e3,1e3,990],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjAIWtYBIoYDCCr2AQquAzI2ogIxMghC`,ticks:248,entryTick:11,exitTick:242,exit:`course`,fastest:231,gigue:[1e3,920,775],raccord:1e3,exigence:2}},{grid:`fa64cd78`,arret:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjEAeu4CKu4CKO4BCCr2AQruAQquAzI2YjCqAg`,ticks:331,entryTick:0,exitTick:324,exit:`course`,fastest:324,gigue:[1e3,980,855],raccord:null,exigence:2},course:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjEEcggy9gEYHJ4DKoYBwgLmAQrGAboFCEI`,ticks:318,entryTick:17,exitTick:311,exit:`course`,fastest:294,gigue:[640,530,400],raccord:1e3,exigence:5},plein:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjEIWs4BCvYCCt4DMvYBCq4DMjaCARCiAg`,ticks:299,entryTick:11,exitTick:293,exit:`course`,fastest:282,gigue:[1e3,980,935],raccord:1e3,exigence:1}},{grid:`fe4925d4`,arret:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjIAugHOAgqeAwqeAxKGAdoC_gEipgYgQghK`,ticks:386,entryTick:0,exitTick:379,exit:`course`,fastest:374,gigue:[1e3,990,715],raccord:null,exigence:2},course:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjIEcggSzgIS_gIKngHKAq4DMvYBCq4DMjbSAgha`,ticks:377,entryTick:17,exitTick:371,exit:`course`,fastest:354,gigue:[965,910,710],raccord:1e3,exigence:2},plein:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjIIWqYBIoYDCq4DCr4BygLWATKGBihiCEo`,ticks:357,entryTick:11,exitTick:350,exit:`course`,fastest:339,gigue:[1e3,995,910],raccord:1e3,exigence:1}},{grid:`56d5165c`,arret:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjMAcv4CKo4DEN4BCCr2AQruAQquAzI2YjCqAg`,ticks:331,entryTick:0,exitTick:324,exit:`course`,fastest:324,gigue:[1e3,995,945],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjMEcgga_gEgLJ4DEo4BugL-AQq2AcIFCEI`,ticks:318,entryTick:17,exitTick:311,exit:`course`,fastest:294,gigue:[875,735,545],raccord:1e3,exigence:3},plein:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjMIWsYBCv4CCt4DMvYBCq4DMjZiMKoC`,ticks:300,entryTick:11,exitTick:293,exit:`course`,fastest:282,gigue:[1e3,985,830],raccord:1e3,exigence:2}},{grid:`410dbc35`,arret:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjQAwgHGAgreAwr-AQq-BiBy`,ticks:278,entryTick:0,exitTick:271,exit:`course`,fastest:270,gigue:[1e3,1e3,980],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjQEcggS9gEw5gMy9gEKrgMyNmIwqgI`,ticks:270,entryTick:17,exitTick:263,exit:`course`,fastest:246,gigue:[1e3,1e3,985],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjQIWtYBIsYDGu4BEoYGJGYISg`,ticks:253,entryTick:11,exitTick:246,exit:`course`,fastest:231,gigue:[1e3,955,865],raccord:1e3,exigence:2}},{grid:`d0eb2d70`,arret:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjUAwgHWAgr-AkKGA4ABlgE1ogFWggM`,ticks:288,entryTick:0,exitTick:281,exit:`course`,fastest:276,gigue:[1e3,970,865],raccord:null,exigence:2},course:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjUEcggS9gFIHJYDIoYBygJeRSwmOUJmsgIYSg`,ticks:275,entryTick:17,exitTick:268,exit:`course`,fastest:249,gigue:[910,780,635],raccord:1e3,exigence:2},plein:{code:`AQQRbW9kdWxlOm11ci1zZXVsOjUIWsYBCv4CCt4DCIwBlgQwmgE`,ticks:252,entryTick:11,exitTick:245,exit:`course`,fastest:234,gigue:[1e3,975,930],raccord:1e3,exigence:1}}]},"mur-trous":{variants:[{grid:`ee4ec45f`,arret:{code:`AQQSbW9kdWxlOm11ci10cm91czowAIoB3gIyhgM6ZsoChgMyhgMi1gcyFvICNqIEDtICJpIF`,ticks:659,entryTick:0,exitTick:655,exit:`plein`,fastest:652,gigue:[1e3,950,825],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOm11ci10cm91czowBHIIEpYCIBSGAyKGAwgaxgMargMZboIHJsICJoIEJoIEJoIE`,ticks:649,entryTick:17,exitTick:644,exit:`plein`,fastest:627,gigue:[975,910,740],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOm11ci10cm91czowCFqGAjL2AnL2AjKGA1LuAwimCAomwgIeogQe8gIu4gQ`,ticks:659,entryTick:11,exitTick:655,exit:`plein`,fastest:634,gigue:[980,880,740],raccord:1e3,exigence:2}},{grid:`d0bae3bf`,arret:{code:`AQQSbW9kdWxlOm11ci10cm91czoxAMIB1gIS9gIqjgMyhgMKrgMKnggSHrICLqIEDsoCLoIF`,ticks:651,entryTick:0,exitTick:647,exit:`plein`,fastest:649,gigue:[1e3,945,820],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOm11ci10cm91czoxBHIIEs4CCoYDEp4DIp4DCp4DCrYHGiaiBJYB0gU2ggQ`,ticks:639,entryTick:17,exitTick:635,exit:`plein`,fastest:614,gigue:[1e3,975,865],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOm11ci10cm91czoxCFrmASKmAxqOAwqeAzJmsgK2AwruBwqeBOoDduIG`,ticks:686,entryTick:11,exitTick:681,exit:`plein`,fastest:670,gigue:[1e3,980,770],raccord:1e3,exigence:2}},{grid:`e9fbf235`,arret:{code:`AQQSbW9kdWxlOm11ci10cm91czoyAMIBxgIKngMKngMajgMg5gMifqIHDoIEJtICFuIDJtoE`,ticks:671,entryTick:0,exitTick:667,exit:`plein`,fastest:665,gigue:[1e3,995,830],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOm11ci10cm91czoyBHIIEoYCQCTmAiKGAxASxgMipgMhdsIGFuoEDtICJqIEJvoD`,ticks:656,entryTick:17,exitTick:652,exit:`plein`,fastest:635,gigue:[1e3,875,745],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOm11ci10cm91czoyCFr2AUr2Aiq2AzKGAzL2AyD2BwoukgQmwgIuugQ2-gM`,ticks:668,entryTick:11,exitTick:664,exit:`plein`,fastest:644,gigue:[1e3,960,855],raccord:1e3,exigence:2}},{grid:`be517c9b`,arret:{code:`AQQSbW9kdWxlOm11ci10cm91czozAMoBvgIKngMKngMilgMYngMSlgGCBya6Aib6BF7iBg`,ticks:653,entryTick:0,exitTick:648,exit:`plein`,fastest:648,gigue:[1e3,830,525],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOm11ci10cm91czozBHIIEu4BOKYDGpYDCBKmAyKGAxqOAYIHJsoCHuoEXuIG`,ticks:641,entryTick:17,exitTick:637,exit:`plein`,fastest:620,gigue:[1e3,710,485],raccord:1e3,exigence:3},plein:{code:`AQQSbW9kdWxlOm11ci10cm91czozCFrFAVYShgMqngMKngMajgMihgGKBya6AibyBF7aBg`,ticks:631,entryTick:11,exitTick:627,exit:`plein`,fastest:616,gigue:[700,475,245],raccord:1e3,exigence:5}},{grid:`a7d093b2`,arret:{code:`AQQSbW9kdWxlOm11ci10cm91czo0AGr-AiKWAzpmygKGAzKGAzLOByo20gI2ggQWigM-4gQ`,ticks:660,entryTick:0,exitTick:655,exit:`plein`,fastest:652,gigue:[1e3,800,685],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOm11ci10cm91czo0BHIIEoYCICSGAyKGAwgaxgMatgMZZvoGJsoCJoIEJoIEJoIE`,ticks:649,entryTick:17,exitTick:644,exit:`plein`,fastest:627,gigue:[875,715,555],raccord:1e3,exigence:3},plein:{code:`AQQSbW9kdWxlOm11ci10cm91czo0CFqGAjL-Aiq2AzKGAzqOBAiWCAomwgImqgQWsgIuogU`,ticks:659,entryTick:11,exitTick:655,exit:`plein`,fastest:634,gigue:[1e3,990,880],raccord:1e3,exigence:2}},{grid:`cd0b2ddb`,arret:{code:`AQQSbW9kdWxlOm11ci10cm91czo1ALoB1gIahgMKngMihgMg5gMKdrIHFvIDDvICJuIDJuIE`,ticks:672,entryTick:0,exitTick:667,exit:`plein`,fastest:668,gigue:[1e3,990,825],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOm11ci10cm91czo1BHIIEvYBKCyGAyKGAwgaxgMipgMhdoIHFqoEHsICJqIEJvoD`,ticks:656,entryTick:17,exitTick:652,exit:`plein`,fastest:635,gigue:[1e3,915,790],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOm11ci10cm91czo1CGLGAhqOAxKWAxCuAyLuAyJ2mgcOigQW2gIeogQmigQ`,ticks:660,entryTick:11,exitTick:655,exit:`plein`,fastest:644,gigue:[1e3,950,865],raccord:1e3,exigence:2}}]},"paroi-friable":{variants:[{grid:`3091df75`,arret:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MADSAdYDCrYDCJYDEqYDCp4BwgYIQg`,ticks:377,entryTick:0,exitTick:370,exit:`course`,fastest:371,gigue:[1e3,960,835],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MARyCKIB1gIK_gIqjgMqfpoC3gM05gMIQg`,ticks:368,entryTick:17,exitTick:361,exit:`course`,fastest:344,gigue:[1e3,1e3,930],raccord:1e3,exigence:1},plein:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MAhahgIapgMqZsoCngMKngcgag`,ticks:340,entryTick:11,exitTick:333,exit:`course`,fastest:322,gigue:[865,730,530],raccord:1e3,exigence:3}},{grid:`bc652c6d`,arret:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQCqAT6aA9YCGuYCIq4DGKYDCp4DErYHIFo`,ticks:467,entryTick:0,exitTick:461,exit:`course`,fastest:461,gigue:[950,870,635],raccord:null,exigence:2},course:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQRyCKoBzgIa9gIijgMSxgMShgMi7gYQWghK`,ticks:423,entryTick:17,exitTick:416,exit:`course`,fastest:399,gigue:[1e3,945,810],raccord:1e3,exigence:2},plein:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MQhapgIK_gIKrgMKrgMKrgMKrgMKLggq9gEszgEIQg`,ticks:392,entryTick:11,exitTick:386,exit:`course`,fastest:375,gigue:[905,885,865],raccord:960,exigence:2}},{grid:`cf635701`,arret:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MgByXsICOL0BngFQhgMipgMKngMKpgMSjgYkxgEISg`,ticks:470,entryTick:0,exitTick:463,exit:`course`,fastest:463,gigue:[1e3,680,355],raccord:null,exigence:3},course:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MgRyCKoB1gIS9gIijgMqjgMilgMa9gYQWghK`,ticks:423,entryTick:17,exitTick:416,exit:`course`,fastest:399,gigue:[1e3,1e3,950],raccord:1e3,exigence:1},plein:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MghapgIK_gIKrgMKrgMKrgMKrgMKLggq9gEszgEIQg`,ticks:392,entryTick:11,exitTick:386,exit:`course`,fastest:375,gigue:[925,905,860],raccord:960,exigence:2}},{grid:`16d19a55`,arret:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwDCAeYDCp4DIKYDCr4DCv4GJEYISg`,ticks:382,entryTick:0,exitTick:375,exit:`course`,fastest:375,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwRyCKIBxgIKjgMqjgMydpoC7gcISg`,ticks:369,entryTick:17,exitTick:362,exit:`course`,fastest:345,gigue:[1e3,985,900],raccord:1e3,exigence:1},plein:{code:`AQQWbW9kdWxlOnBhcm9pLWZyaWFibGU6MwhahgIqngMijgGaAqYDCp4HIHo`,ticks:342,entryTick:11,exitTick:335,exit:`course`,fastest:324,gigue:[1e3,1e3,990],raccord:1e3,exigence:1}}]},pendule:{variants:[{grid:`1d41c771`,arret:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MADiBDbyAzbyBAhi`,ticks:241,entryTick:0,exitTick:234,exit:`course`,fastest:232,gigue:[1e3,1e3,895],raccord:null,exigence:2},course:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MARyCPICLroENvIECGI`,ticks:234,entryTick:17,exitTick:227,exit:`course`,fastest:206,gigue:[1e3,965,855],raccord:920,exigence:2},plein:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MAhaTsIDpgGKBA`,ticks:161,entryTick:11,exitTick:157,exit:`plein`,fastest:146,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`13c22e84`,arret:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MQDaBB7yAyaCBSBS`,ticks:238,entryTick:0,exitTick:231,exit:`course`,fastest:231,gigue:[770,565,465],raccord:null,exigence:5},course:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MQRyCPICLroENvIECGI`,ticks:234,entryTick:17,exitTick:227,exit:`course`,fastest:207,gigue:[895,830,675],raccord:920,exigence:2},plein:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MQhaTpIDpgG6BA`,ticks:161,entryTick:11,exitTick:157,exit:`plein`,fastest:146,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`4a66e837`,arret:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MgDyBDbiAzbyBAha`,ticks:240,entryTick:0,exitTick:234,exit:`course`,fastest:232,gigue:[1e3,980,865],raccord:null,exigence:2},course:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MgRyCPICLroENvIECGI`,ticks:234,entryTick:17,exitTick:227,exit:`course`,fastest:206,gigue:[1e3,975,785],raccord:920,exigence:2},plein:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MghaRtIDpgGCBA`,ticks:161,entryTick:11,exitTick:157,exit:`plein`,fastest:146,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}},{grid:`38153124`,arret:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MwDqBB7CAybCBShK`,ticks:242,entryTick:0,exitTick:235,exit:`course`,fastest:235,gigue:[540,490,450],raccord:null,exigence:5},course:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MwRyCKIDHvoDJqIFIEI`,ticks:233,entryTick:17,exitTick:226,exit:`course`,fastest:209,gigue:[800,615,475],raccord:1e3,exigence:3},plein:{code:`AQQQbW9kdWxlOnBlbmR1bGU6MwhaTtIDbrIE`,ticks:161,entryTick:11,exitTick:157,exit:`plein`,fastest:146,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"petits-trous":{variants:[{grid:`e0eaaf71`,arret:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czowAIIEJtICHuIEPuICJoICQUo`,ticks:293,entryTick:0,exitTick:286,exit:`course`,fastest:286,gigue:[965,950,940],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czowBHIIGi7CBRaKBB6KAxbqAghS`,ticks:288,entryTick:17,exitTick:281,exit:`course`,fastest:264,gigue:[1e3,995,975],raccord:960,exigence:1},plein:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czowCFqGAYIFRoIF`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`9c0be2f4`,arret:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czoxAKoCJvoFJqIDJoIEJsICQTo`,ticks:319,entryTick:0,exitTick:313,exit:`course`,fastest:313,gigue:[1e3,975,950],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czoxBHIIqgI-8gIe-gVu0gU`,ticks:306,entryTick:17,exitTick:302,exit:`plein`,fastest:285,gigue:[980,850,625],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czoxCKICVqIFVooF`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`fde6a784`,arret:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czoyANoCPtoFDooFDtoCDpIE`,ticks:334,entryTick:0,exitTick:330,exit:`plein`,fastest:332,gigue:[1e3,935,820],raccord:null,exigence:2},course:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czoyBHIIkgE2-gU2qgQ24gM2ogIwMUo`,ticks:338,entryTick:17,exitTick:331,exit:`course`,fastest:309,gigue:[1e3,950,785],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czoyCLoCfuIFfroF`,ticks:248,entryTick:11,exitTick:244,exit:`plein`,fastest:233,gigue:[1e3,1e3,930],raccord:1e3,exigence:1}},{grid:`4a6d8121`,arret:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czozALICJvIFJqIDJoIEJsICQTo`,ticks:319,entryTick:0,exitTick:313,exit:`course`,fastest:313,gigue:[1e3,985,960],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czozBHIIwgIm8gIO-gV20gU`,ticks:305,entryTick:17,exitTick:300,exit:`plein`,fastest:285,gigue:[930,810,720],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czozCKICVqIFTpIF`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,1e3,910],raccord:1e3,exigence:1}},{grid:`6ce29527`,arret:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czo0AIIEJsICJuIEJoIFQCIIYg`,ticks:297,entryTick:0,exitTick:290,exit:`course`,fastest:290,gigue:[1e3,975,900],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czo0BHIIMi7qBQ7KAy7iBSBC`,ticks:286,entryTick:17,exitTick:279,exit:`course`,fastest:263,gigue:[1e3,1e3,1e3],raccord:960,exigence:1},plein:{code:`AQQVbW9kdWxlOnBldGl0cy10cm91czo0CFqGAYIFJqIF`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"piliers-scie":{variants:[{grid:`9f278765`,arret:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTowAIoDJtIDfroEPsIHlgHqBH7CBQ`,ticks:522,entryTick:0,exitTick:518,exit:`plein`,fastest:515,gigue:[890,610,315],raccord:null,exigence:3},course:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTowBHIIwgLGBSqOAZoKftIEdqoF`,ticks:516,entryTick:17,exitTick:511,exit:`plein`,fastest:498,gigue:[795,735,605],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTowCGKOAeIDDsIC3gGKBN4BogOGAdoF`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,895,615],raccord:1e3,exigence:2}},{grid:`a7e2e900`,arret:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZToxAJoDLtoDXrIERsoFjgMKbroErgGCBQ`,ticks:528,entryTick:0,exitTick:524,exit:`plein`,fastest:520,gigue:[770,360,195],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZToxBHIIwgK2BTKWAboHvgMKbrIEfroF`,ticks:525,entryTick:17,exitTick:520,exit:`plein`,fastest:506,gigue:[935,700,435],raccord:1e3,exigence:3},plein:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZToxCGKOAfIEZpIEdvoCzgGCAy6iBQ`,ticks:408,entryTick:11,exitTick:403,exit:`plein`,fastest:391,gigue:[1e3,755,440],raccord:1e3,exigence:3}},{grid:`bd57f562`,arret:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZToyAMIDDroDhgGqBD7KB4YB8gSOAZIF`,ticks:518,entryTick:0,exitTick:514,exit:`plein`,fastest:515,gigue:[970,725,490],raccord:null,exigence:3},course:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZToyBHII0gKuBTKWAZIKduIEbroF`,ticks:518,entryTick:17,exitTick:513,exit:`plein`,fastest:498,gigue:[980,785,415],raccord:1e3,exigence:3},plein:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZToyCGKOAfIEZrIDpgMKrgHCA4YBygU`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[1e3,1e3,730],raccord:1e3,exigence:2}},{grid:`177e6495`,arret:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTozALoDJrIDbsoEPrIHlgGiBMYBugU`,ticks:521,entryTick:0,exitTick:517,exit:`plein`,fastest:513,gigue:[950,555,400],raccord:null,exigence:4},course:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTozBHIIggIOogN20gQuggemAboEtgHCBQ`,ticks:506,entryTick:17,exitTick:502,exit:`plein`,fastest:488,gigue:[860,450,180],raccord:1e3,exigence:4},plein:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTozCGKOAaoDNqIDpgG6BJYBqgN-2gU`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[710,380,135],raccord:1e3,exigence:5}},{grid:`e6605c40`,arret:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTo0AMIDHsIDbsIELqoFhgMSZsoEhgGiBQ`,ticks:525,entryTick:0,exitTick:520,exit:`plein`,fastest:520,gigue:[745,330,185],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTo0BHIIygLuBCL-AbIHvgMK3gHiA4YBsgU`,ticks:531,entryTick:17,exitTick:527,exit:`plein`,fastest:506,gigue:[1e3,955,830],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTo0CGqGAfIEZpIEbpoDvgHyAi6qBQ`,ticks:408,entryTick:11,exitTick:403,exit:`plein`,fastest:391,gigue:[1e3,725,420],raccord:1e3,exigence:3}},{grid:`dc71a245`,arret:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTo1AIIDJvIDZsIENsIHlgHyBGbCBQ`,ticks:520,entryTick:0,exitTick:516,exit:`plein`,fastest:515,gigue:[785,540,280],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTo1BHII4gLuBCLuAeoKngHiA0baBQ`,ticks:520,entryTick:17,exitTick:516,exit:`plein`,fastest:498,gigue:[1e3,950,690],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBpbGllcnMtc2NpZTo1CFqeAbIDLpIDpgGSBMYBkgNmigY`,ticks:408,entryTick:11,exitTick:404,exit:`plein`,fastest:393,gigue:[890,395,130],raccord:1e3,exigence:4}}]},piliers:{variants:[{grid:`aadaf7dd`,arret:{code:`AQQQbW9kdWxlOnBpbGllcnM6MAC6AxbKA36iBG6SBQhS`,ticks:303,entryTick:0,exitTick:296,exit:`course`,fastest:299,gigue:[1e3,970,855],raccord:null,exigence:2},course:{code:`AQQQbW9kdWxlOnBpbGllcnM6MARyCCpeqgRu8gRmogUwag`,ticks:306,entryTick:17,exitTick:300,exit:`course`,fastest:282,gigue:[805,590,355],raccord:920,exigence:4},plein:{code:`AQQQbW9kdWxlOnBpbGllcnM6MAhalgGqA4YB0gU`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,960,785],raccord:1e3,exigence:2}},{grid:`da04bc37`,arret:{code:`AQQQbW9kdWxlOnBpbGllcnM6MQDyAya6Ayb6ARbyAybyAiayAyBK`,ticks:341,entryTick:0,exitTick:334,exit:`course`,fastest:334,gigue:[825,460,325],raccord:null,exigence:4},course:{code:`AQQQbW9kdWxlOnBpbGllcnM6MQRyCNICFoIDPsoCFsIDJqoDHsIDCEo`,ticks:339,entryTick:17,exitTick:332,exit:`course`,fastest:315,gigue:[670,345,370],raccord:960,exigence:5},plein:{code:`AQQQbW9kdWxlOnBpbGllcnM6MQiCAQ6aA0a6A2byBA`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,855,665],raccord:1e3,exigence:2}},{grid:`99611d07`,arret:{code:`AQQQbW9kdWxlOnBpbGllcnM6MgCyAxbSA3ayBG6KBQhS`,ticks:303,entryTick:0,exitTick:296,exit:`course`,fastest:299,gigue:[1e3,990,855],raccord:null,exigence:2},course:{code:`AQQQbW9kdWxlOnBpbGllcnM6MgRyCGpe6gNu8gRmogUwag`,ticks:306,entryTick:17,exitTick:300,exit:`course`,fastest:282,gigue:[820,625,360],raccord:920,exigence:3},plein:{code:`AQQQbW9kdWxlOnBpbGllcnM6MghijgHaAxaSBg`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,975,710],raccord:1e3,exigence:2}},{grid:`1563275b`,arret:{code:`AQQQbW9kdWxlOnBpbGllcnM6MwDyAyayAybyASaKBK4BqgUgQg`,ticks:341,entryTick:0,exitTick:334,exit:`course`,fastest:334,gigue:[875,505,375],raccord:null,exigence:4},course:{code:`AQQQbW9kdWxlOnBpbGllcnM6MwRyCNICDvoCRroCJsIDLooDNsoDCEI`,ticks:338,entryTick:17,exitTick:332,exit:`course`,fastest:315,gigue:[950,665,505],raccord:1e3,exigence:3},plein:{code:`AQQQbW9kdWxlOnBpbGllcnM6Mwh6FoIDVsIDZvIE`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,865,620],raccord:1e3,exigence:2}},{grid:`dff05069`,arret:{code:`AQQQbW9kdWxlOnBpbGllcnM6NADKAw7CA3aiBD6yBRhC`,ticks:300,entryTick:0,exitTick:293,exit:`course`,fastest:299,gigue:[1e3,1e3,860],raccord:null,exigence:2},course:{code:`AQQQbW9kdWxlOnBpbGllcnM6NARyCLIBJoIDLoICDvIDRtIC9gIkRghK`,ticks:307,entryTick:17,exitTick:300,exit:`course`,fastest:283,gigue:[1e3,695,525],raccord:1e3,exigence:3},plein:{code:`AQQQbW9kdWxlOnBpbGllcnM6NAhijgHiAzbqBQ`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,1e3,810],raccord:1e3,exigence:2}},{grid:`c4acf61e`,arret:{code:`AQQQbW9kdWxlOnBpbGllcnM6NQDiAybCAybKAg6KAxlWggImggUgQghK`,ticks:366,entryTick:0,exitTick:359,exit:`course`,fastest:359,gigue:[810,520,455],raccord:null,exigence:4},course:{code:`AQQQbW9kdWxlOnBpbGllcnM6NQRyCMIBXBnyAz7iAg6qA06iAibCBQhK`,ticks:367,entryTick:17,exitTick:360,exit:`course`,fastest:343,gigue:[1e3,950,745],raccord:960,exigence:2},plein:{code:`AQQQbW9kdWxlOnBpbGllcnM6NQj6AXaaA2aCAx7yAw`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,970,730],raccord:1e3,exigence:2}}]},"plafond-pics":{variants:[{grid:`e80f38a8`,arret:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczowAIoEHrICLsoDHuoCRoIECFI`,ticks:299,entryTick:0,exitTick:292,exit:`course`,fastest:292,gigue:[785,455,270],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczowBHIIqgImqgJG4gMm4gJO-gMoWg`,ticks:297,entryTick:17,exitTick:290,exit:`course`,fastest:273,gigue:[920,530,410],raccord:1e3,exigence:4},plein:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczowCPIBRtoDTsoF`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[1e3,810,530],raccord:1e3,exigence:3}},{grid:`dbf36b11`,arret:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczoxAIoEHqIEHtIDHqoDHooF`,ticks:337,entryTick:0,exitTick:332,exit:`plein`,fastest:332,gigue:[585,300,135],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczoxBHIIygIssgRGmgQ-ggMIogE-4gIk4gMISg`,ticks:407,entryTick:17,exitTick:400,exit:`course`,fastest:383,gigue:[1e3,695,355],raccord:1e3,exigence:3},plein:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczoxCGI-sgMO6gIO-gIm6gQ`,ticks:248,entryTick:11,exitTick:244,exit:`plein`,fastest:233,gigue:[1e3,915,605],raccord:1e3,exigence:2}},{grid:`5f54e552`,arret:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczoyAPoDJsICLqIDJsoCFOoFIHo`,ticks:323,entryTick:0,exitTick:316,exit:`course`,fastest:311,gigue:[635,315,165],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczoyBHIIsgImygIWqgMmygIOigNOigIJEFo`,ticks:304,entryTick:17,exitTick:297,exit:`course`,fastest:280,gigue:[645,335,215],raccord:960,exigence:5},plein:{code:`AQQVbW9kdWxlOnBsYWZvbmQtcGljczoyCGI20gJW2gIOigU`,ticks:195,entryTick:11,exitTick:191,exit:`plein`,fastest:180,gigue:[550,305,140],raccord:1e3,exigence:5}}]},"pont-friable":{variants:[{grid:`57b90f55`,arret:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZTowAKIGRsIFJpIE`,ticks:266,entryTick:0,exitTick:262,exit:`plein`,fastest:262,gigue:[510,545,495],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZTowBHII2gRmogUuwgQ`,ticks:263,entryTick:17,exitTick:259,exit:`plein`,fastest:242,gigue:[1e3,875,710],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZTowCFpWugROogY`,ticks:201,entryTick:11,exitTick:197,exit:`plein`,fastest:186,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6057996b`,arret:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZToxAPoFFuICHqIEJuoE`,ticks:293,entryTick:0,exitTick:289,exit:`plein`,fastest:289,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZToxBHII0gQW-gIOkgQm4gQ`,ticks:285,entryTick:17,exitTick:281,exit:`plein`,fastest:266,gigue:[1e3,1e3,995],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZToxCFqOAcoDHroCLsoF`,ticks:221,entryTick:11,exitTick:217,exit:`plein`,fastest:206,gigue:[1e3,990,975],raccord:1e3,exigence:1}},{grid:`643dc599`,arret:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZToyAKoGRroFhgQy`,ticks:266,entryTick:0,exitTick:262,exit:`plein`,fastest:262,gigue:[590,250,115],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZToyBHIImgR-wgEuigSWBDBC`,ticks:271,entryTick:17,exitTick:264,exit:`course`,fastest:245,gigue:[1e3,1e3,950],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZToyCIIBLuoEjgYy`,ticks:201,entryTick:11,exitTick:197,exit:`plein`,fastest:186,gigue:[1e3,730,495],raccord:1e3,exigence:3}},{grid:`b49f0f79`,arret:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZTozAKIGRsIFJsIDIFo`,ticks:271,entryTick:0,exitTick:264,exit:`course`,fastest:264,gigue:[505,550,550],raccord:null,exigence:5},course:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZTozBHII0gRmggUu2gNgMUI`,ticks:271,entryTick:17,exitTick:264,exit:`course`,fastest:247,gigue:[985,795,770],raccord:1e3,exigence:2},plein:{code:`AQQVbW9kdWxlOnBvbnQtZnJpYWJsZTozCKIDRooENtIClgFS`,ticks:201,entryTick:11,exitTick:197,exit:`plein`,fastest:186,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}}]},"pont-patrouille":{variants:[{grid:`7f399d54`,arret:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowAMIBRsIDtgUiLoICKNoBPpoDzgQSRuIBlgH6Al6CA4YDggMISg`,ticks:646,entryTick:0,exitTick:639,exit:`course`,fastest:639,gigue:[540,265,85],raccord:null,exigence:5},course:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowBHIIEt4HCm7SBCbSA36iA9YBugK-BjI`,ticks:531,entryTick:17,exitTick:527,exit:`plein`,fastest:511,gigue:[505,195,50],raccord:1e3,exigence:5},plein:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZTowCJoBlgUyNvoCpgHSAt4DKo4GKg`,ticks:388,entryTick:11,exitTick:384,exit:`plein`,fastest:373,gigue:[880,645,395],raccord:1e3,exigence:3}},{grid:`940366f6`,arret:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxAMIBZsIDJoIDpgVCZsIDtgQaXooCXtICRpIDLuIEGEIISg`,ticks:634,entryTick:0,exitTick:627,exit:`course`,fastest:627,gigue:[680,305,155],raccord:null,exigence:5},course:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxBHIIEpYGClbiAz6aA64FIkaCAmbiAkWCAm6qAlaCAiaCBAhC`,ticks:638,entryTick:17,exitTick:631,exit:`course`,fastest:615,gigue:[755,320,155],raccord:960,exigence:5},plein:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToxCGImwgNuigTOBCKmAyKmBio`,ticks:388,entryTick:11,exitTick:384,exit:`plein`,fastest:373,gigue:[905,705,520],raccord:1e3,exigence:3}},{grid:`af27232c`,arret:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyAMIBRroDvgUaNooCIIICJoIDxgQiRuIBjgH6Al7qAk66AiaCAwhC`,ticks:645,entryTick:0,exitTick:638,exit:`course`,fastest:639,gigue:[595,355,170],raccord:null,exigence:5},course:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyBHIIEsYHImbaBD7KA26iA84BugLGBjo`,ticks:532,entryTick:17,exitTick:528,exit:`plein`,fastest:511,gigue:[525,150,20],raccord:1e3,exigence:5},plein:{code:`AQQYbW9kdWxlOnBvbnQtcGF0cm91aWxsZToyCFr2BRoOygL2AdoC1gMqjgYq`,ticks:388,entryTick:11,exitTick:384,exit:`plein`,fastest:373,gigue:[910,860,850],raccord:1e3,exigence:2}}]},"puits-descente":{variants:[{grid:`f3203b10`,arret:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAA0gEO2gN5wgcWmhM`,ticks:530,entryTick:0,exitTick:526,exit:`plein`,fastest:530,gigue:[870,670,390],raccord:null,exigence:3},course:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAEcgjaA6kBtgcKFroT`,ticks:527,entryTick:17,exitTick:523,exit:`plein`,fastest:506,gigue:[970,770,390],raccord:1e3,exigence:3},plein:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjAI-gKIAXGaByayEw`,ticks:507,entryTick:11,exitTick:503,exit:`plein`,fastest:492,gigue:[855,620,415],raccord:1e3,exigence:3}},{grid:`638f813a`,arret:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEAkgE2kgFJaskBgAGSAQnaBR6qEw`,ticks:527,entryTick:0,exitTick:522,exit:`plein`,fastest:523,gigue:[940,645,475],raccord:null,exigence:3},course:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEEcggaLlAycIEC6gEg3gUSJrIT`,ticks:525,entryTick:17,exitTick:520,exit:`plein`,fastest:505,gigue:[815,510,265],raccord:1e3,exigence:4},plein:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjEIugF4MhipAZgBtgEkhgVSFqoT`,ticks:514,entryTick:11,exitTick:509,exit:`plein`,fastest:501,gigue:[700,305,175],raccord:1e3,exigence:5}},{grid:`23b62775`,arret:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIAmgEmigRhgggmogUmmg8`,ticks:563,entryTick:0,exitTick:559,exit:`plein`,fastest:559,gigue:[835,655,410],raccord:null,exigence:3},course:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIEcggSJqIBvQE4IRhqIVJA4gYm4gQm4g8`,ticks:557,entryTick:17,exitTick:553,exit:`plein`,fastest:536,gigue:[760,325,220],raccord:1e3,exigence:5},plein:{code:`AQQXbW9kdWxlOnB1aXRzLWRlc2NlbnRlOjIIugLJAWCaCD6SBQ6yDw`,ticks:543,entryTick:11,exitTick:538,exit:`plein`,fastest:527,gigue:[1e3,1e3,825],raccord:1e3,exigence:2}}]},puits:{variants:[{grid:`60c27f29`,arret:{code:`AQQObW9kdWxlOnB1aXRzOjAAWj7iA_EBcDIgogJm0gI2ogIIWg`,ticks:276,entryTick:0,exitTick:269,exit:`course`,fastest:269,gigue:[775,595,435],raccord:null,exigence:5},course:{code:`AQQObW9kdWxlOnB1aXRzOjAEcggSFuIDWfgC5gEgTsoCNuICCEo`,ticks:279,entryTick:17,exitTick:272,exit:`course`,fastest:255,gigue:[1e3,825,715],raccord:1e3,exigence:2},plein:{code:`AQQObW9kdWxlOnB1aXRzOjAI-gKABSHCAibCAiaiAiBi`,ticks:271,entryTick:11,exitTick:264,exit:`course`,fastest:253,gigue:[1e3,1e3,970],raccord:1e3,exigence:1}},{grid:`9f0fd7fe`,arret:{code:`AQQObW9kdWxlOnB1aXRzOjEAUj7qA5EBwAHiA36qAWTGAQhK`,ticks:262,entryTick:0,exitTick:255,exit:`course`,fastest:255,gigue:[995,945,835],raccord:null,exigence:2},course:{code:`AQQObW9kdWxlOnB1aXRzOjEEcggaJooEkAFhogMmwgImogIgYg`,ticks:269,entryTick:17,exitTick:262,exit:`course`,fastest:245,gigue:[1e3,965,835],raccord:1e3,exigence:2},plein:{code:`AQQObW9kdWxlOnB1aXRzOjEI2gJBQoEBIMIBSOICGIIBJmIh5gIISg`,ticks:249,entryTick:11,exitTick:242,exit:`course`,fastest:231,gigue:[1e3,980,915],raccord:1e3,exigence:1}}]},quinconce:{variants:[{grid:`e6c257b5`,arret:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTowAJoDJqoEHsoDhgOiAiBC`,ticks:280,entryTick:0,exitTick:273,exit:`course`,fastest:273,gigue:[670,480,415],raccord:null,exigence:5},course:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTowBHII-gEuogM0kgS2BOICCEI`,ticks:298,entryTick:17,exitTick:291,exit:`course`,fastest:274,gigue:[1e3,875,550],raccord:1e3,exigence:3},plein:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTowCFo2kgOGAZIG`,ticks:181,entryTick:11,exitTick:177,exit:`plein`,fastest:166,gigue:[1e3,790,500],raccord:1e3,exigence:3}},{grid:`26ba8d4b`,arret:{code:`AQQSbW9kdWxlOnF1aW5jb25jZToxAOIDNvIELuoDLsIF`,ticks:303,entryTick:0,exitTick:298,exit:`plein`,fastest:293,gigue:[925,565,315],raccord:null,exigence:4},course:{code:`AQQSbW9kdWxlOnF1aW5jb25jZToxBHIIqgIm4gQemgQmogU`,ticks:290,entryTick:17,exitTick:285,exit:`plein`,fastest:268,gigue:[595,415,290],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnF1aW5jb25jZToxCFo2ggS2AYIH`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}},{grid:`f61b9116`,arret:{code:`AQQSbW9kdWxlOnF1aW5jb25jZToyAOIDZiCyBV6CAwyqA07iBCbiAghC`,ticks:417,entryTick:0,exitTick:410,exit:`course`,fastest:410,gigue:[1e3,995,980],raccord:null,exigence:1},course:{code:`AQQSbW9kdWxlOnF1aW5jb25jZToyBHIIkgIekgYuogQ2qgU`,ticks:314,entryTick:17,exitTick:309,exit:`plein`,fastest:292,gigue:[790,505,405],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnF1aW5jb25jZToyCHJGygM2sgNOogY`,ticks:248,entryTick:11,exitTick:244,exit:`plein`,fastest:233,gigue:[1e3,1e3,820],raccord:1e3,exigence:2}},{grid:`1a10ac83`,arret:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTozAOIDNuoELvIDJsIF`,ticks:302,entryTick:0,exitTick:298,exit:`plein`,fastest:293,gigue:[955,625,400],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTozBHII8gEeogUm-gMuqgU`,ticks:289,entryTick:17,exitTick:285,exit:`plein`,fastest:268,gigue:[770,505,355],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTozCFo2igSWAZoH`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[770,450,265],raccord:1e3,exigence:5}},{grid:`c9f943da`,arret:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTo0AOIDJtIENvIDLtoF`,ticks:302,entryTick:0,exitTick:298,exit:`plein`,fastest:293,gigue:[915,735,485],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTo0BHIIogIm8gQeigQmqgU`,ticks:290,entryTick:17,exitTick:285,exit:`plein`,fastest:268,gigue:[630,450,265],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTo0CFo2-gO2AYoH`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,915],raccord:1e3,exigence:1}},{grid:`64235541`,arret:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTo1ANIDJvoDHqIDJqIFIDo`,ticks:279,entryTick:0,exitTick:273,exit:`course`,fastest:273,gigue:[535,405,200],raccord:null,exigence:5},course:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTo1BHIIggIuqgMsigQumgMWqgMYSg`,ticks:298,entryTick:17,exitTick:291,exit:`course`,fastest:274,gigue:[1e3,765,465],raccord:1e3,exigence:3},plein:{code:`AQQSbW9kdWxlOnF1aW5jb25jZTo1CFou2gKuAfoESUYZUg`,ticks:189,entryTick:11,exitTick:182,exit:`course`,fastest:171,gigue:[940,760,625],raccord:960,exigence:2}}]},"rebonds-doux":{variants:[{grid:`73bcad3e`,arret:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDowAOICJsICJqIEJuIDCEI`,ticks:233,entryTick:0,exitTick:227,exit:`course`,fastest:227,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDowBHIIEibyBBaiAw7aAyBS`,ticks:227,entryTick:17,exitTick:220,exit:`course`,fastest:206,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDowCFpmggM2ggQ`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`264cfd35`,arret:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDoxAOIBJooGHuoDHoIDKEo`,ticks:258,entryTick:0,exitTick:251,exit:`course`,fastest:251,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDoxBHIIEiaKBg6CBDaCAwhS`,ticks:248,entryTick:17,exitTick:241,exit:`course`,fastest:227,gigue:[1e3,1e3,1e3],raccord:920,exigence:1},plein:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDoxCLoBZsIDJsoE`,ticks:168,entryTick:11,exitTick:164,exit:`plein`,fastest:153,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6588769d`,arret:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDoyAOIBJsIFJqIDRsIDCEo`,ticks:250,entryTick:0,exitTick:243,exit:`course`,fastest:243,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDoyBHII0gE2ogI2wgQm6gMgGghK`,ticks:243,entryTick:17,exitTick:236,exit:`course`,fastest:216,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDoyCFqGAaIDJsIE`,ticks:155,entryTick:11,exitTick:151,exit:`plein`,fastest:140,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`52a8f1e4`,arret:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDozAOICJsICJqoEHsIDIFo`,ticks:235,entryTick:0,exitTick:228,exit:`course`,fastest:228,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDozBHIIcjbSAjaaBCaaBAhC`,ticks:230,entryTick:17,exitTick:223,exit:`course`,fastest:206,gigue:[1e3,1e3,1e3],raccord:960,exigence:1},plein:{code:`AQQVbW9kdWxlOnJlYm9uZHMtZG91eDozCFpmggM2ggQ`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-mur-iles":{variants:[{grid:`ed474f4e`,arret:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MACqAT7iBYYDKp4DCr4FCma6AybyAR6KBCaKAg6yBCbyBCBC`,ticks:684,entryTick:0,exitTick:677,exit:`course`,fastest:677,gigue:[1e3,625,360],raccord:null,exigence:3},course:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MARyCIoCpgIipgMabpoCxgGSAqYBygQ20gOWAdoELvoJ`,ticks:663,entryTick:17,exitTick:659,exit:`plein`,fastest:643,gigue:[930,570,320],raccord:1e3,exigence:4},plein:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MAjiBJYDOtYCIsYFOjbKA7YC8gMmsgo`,ticks:607,entryTick:11,exitTick:603,exit:`plein`,fastest:599,gigue:[855,630,345],raccord:1e3,exigence:3}},{grid:`b38aa751`,arret:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQDCASbqBf4COp4DCq4FIkaaAz66AxbqAzbKAg7iCA`,ticks:688,entryTick:0,exitTick:684,exit:`plein`,fastest:684,gigue:[995,790,490],raccord:null,exigence:3},course:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQRyCOIBxgIyhgMyZqICxgHyAcYBwgQ2sgM2ggM2ugMu8gE28gg`,ticks:699,entryTick:17,exitTick:695,exit:`plein`,fastest:677,gigue:[770,300,120],raccord:1e3,exigence:5},plein:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MQjCBK4DMoYDEq4FKkbSAz7yAg66BLYC0gg`,ticks:638,entryTick:11,exitTick:634,exit:`plein`,fastest:624,gigue:[1e3,950,755],raccord:1e3,exigence:2}},{grid:`d68ff1d5`,arret:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgCqAT7iBYYDKp4DEr4FEmaqAybyARaaBCb6ARbiBCbCBCBC`,ticks:684,entryTick:0,exitTick:677,exit:`course`,fastest:677,gigue:[825,490,330],raccord:null,exigence:4},course:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgRyCOIB5gIShgMyZqICzgGCAq4BwgQ22gOeAdoELvoJ`,ticks:664,entryTick:17,exitTick:659,exit:`plein`,fastest:643,gigue:[865,525,235],raccord:1e3,exigence:4},plein:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MgjiBI4DQp4DEpYFIjbCAy7qAR6KBCa6Cg`,ticks:607,entryTick:11,exitTick:603,exit:`plein`,fastest:599,gigue:[800,390,205],raccord:1e3,exigence:4}},{grid:`8bbe858e`,arret:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MwC6B_4CMp4DCrYFQja6A0byAg6yBIYDmgg`,ticks:683,entryTick:0,exitTick:679,exit:`plein`,fastest:684,gigue:[1e3,925,735],raccord:null,exigence:2},course:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6MwRyCNoB5gIKtgMKlgMKpgMK3gUiLpoDRsIDDtIDrgLiCA`,ticks:697,entryTick:17,exitTick:693,exit:`plein`,fastest:677,gigue:[945,720,520],raccord:1e3,exigence:3},plein:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6Mwj6BIYDIqYDEv4EOj7KAzaaAx6iBCb6ARbaCA`,ticks:639,entryTick:11,exitTick:635,exit:`plein`,fastest:624,gigue:[895,580,340],raccord:1e3,exigence:4}},{grid:`b4728776`,arret:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NACiB54BkgKmAfoBpgHCASkiCYIDHroD3gKqAx6SCg`,ticks:641,entryTick:0,exitTick:637,exit:`plein`,fastest:638,gigue:[715,405,180],raccord:null,exigence:5},course:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NARyCLoCEEIYChkaGeoBpgGSAp4BsgJmkgUeigMWsgNmigs`,ticks:608,entryTick:17,exitTick:604,exit:`plein`,fastest:587,gigue:[570,295,140],raccord:1e3,exigence:5},plein:{code:`AQQZbW9kdWxlOnJlc3NvcnQtbXVyLWlsZXM6NAiqBe4CEv4DIeYFEh76AibKAg7SAx6SCg`,ticks:612,entryTick:11,exitTick:608,exit:`plein`,fastest:597,gigue:[730,405,140],raccord:1e3,exigence:5}}]},"ressort-mur":{variants:[{grid:`1223a2f6`,arret:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjAAUm6aATBBQjgp4gYgYghK`,ticks:210,entryTick:0,exitTick:203,exit:`course`,fastest:203,gigue:[1e3,965,865],raccord:null,exigence:2},course:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjAEcgi6BBghGhEaIBIZGh0aGRogEhkaGTIUCiASIBIdGhkaGRoZeg`,ticks:197,entryTick:17,exitTick:190,exit:`course`,fastest:173,gigue:[1e3,1e3,995],raccord:960,exigence:1},plein:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjAI2gQgwQFAQWIIGgha`,ticks:147,entryTick:11,exitTick:141,exit:`course`,fastest:130,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`0da2820f`,arret:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjEAWla6ASBBQjgpQkAhxgYISg`,ticks:210,entryTick:0,exitTick:203,exit:`course`,fastest:203,gigue:[1e3,1e3,980],raccord:null,exigence:1},course:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjEEcggSHoIIGBFCIQgKCBIIEggSCBIIWg`,ticks:191,entryTick:17,exitTick:184,exit:`course`,fastest:167,gigue:[710,795,740],raccord:1e3,exigence:2},plein:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjEI2gQgwQFA4gE`,ticks:139,entryTick:11,exitTick:132,exit:`course`,fastest:121,gigue:[1e3,1e3,1e3],raccord:960,exigence:1}},{grid:`e864eba2`,arret:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjIAQoYBmgEoQUJAIaIGICIgYghK`,ticks:210,entryTick:0,exitTick:203,exit:`course`,fastest:203,gigue:[845,815,685],raccord:null,exigence:2},course:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjIEcgi6BBghGhEaIBIZGh0aGRogEhkaGTIUCiASIBIdGhkaGRoZeg`,ticks:197,entryTick:17,exitTick:190,exit:`course`,fastest:173,gigue:[1e3,1e3,1e3],raccord:960,exigence:1},plein:{code:`AQQUbW9kdWxlOnJlc3NvcnQtbXVyOjII2gQgwQFAQWIIGgha`,ticks:147,entryTick:11,exitTick:141,exit:`course`,fastest:130,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-plafond":{variants:[{grid:`e5247a65`,arret:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowAMIBRoIKIHo`,ticks:211,entryTick:0,exitTick:204,exit:`course`,fastest:204,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowBHIIamaKAUEg4gcISg`,ticks:203,entryTick:17,exitTick:196,exit:`course`,fastest:179,gigue:[1e3,1e3,990],raccord:920,exigence:1},plein:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowCOoB1gIyZjHSBQgqCEo`,ticks:201,entryTick:11,exitTick:194,exit:`course`,fastest:183,gigue:[940,855,705],raccord:1e3,exigence:2}},{grid:`cfcfbc16`,arret:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxAJIBhgwISg`,ticks:220,entryTick:0,exitTick:213,exit:`course`,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxBHIIYnaCAUEgjgccpgEISg`,ticks:215,entryTick:17,exitTick:208,exit:`course`,fastest:191,gigue:[1e3,970,805],raccord:960,exigence:2},plein:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxCMICvgIaVkWKBgg6`,ticks:205,entryTick:11,exitTick:199,exit:`course`,fastest:188,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`8278a5fa`,arret:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyAJIBhgwISg`,ticks:220,entryTick:0,exitTick:213,exit:`course`,fastest:213,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyBHIIYm6KAUEgjgccpgEISg`,ticks:215,entryTick:17,exitTick:208,exit:`course`,fastest:191,gigue:[1e3,960,820],raccord:960,exigence:2},plein:{code:`AQQYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyCNIB1gMqxgJwggFG4gFkRiRGCEo`,ticks:237,entryTick:11,exitTick:230,exit:`course`,fastest:219,gigue:[990,885,750],raccord:1e3,exigence:2}}]},"ressorts-escalier":{variants:[{grid:`cbe46e69`,arret:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAASn6iASBBQkDBAd4IKEXCBiTqAg`,ticks:401,entryTick:0,exitTick:394,exit:`course`,fastest:394,gigue:[660,580,530],raccord:null,exigence:5},course:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAEcgjSAaYEEp4RGEIIQg`,ticks:406,entryTick:17,exitTick:400,exit:`course`,fastest:381,gigue:[1e3,1e3,995],raccord:1e3,exigence:1},plein:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjAIwgH-ByLmByRmCEo`,ticks:305,entryTick:11,exitTick:298,exit:`course`,fastest:287,gigue:[1e3,895,820],raccord:1e3,exigence:2}},{grid:`1e9474f6`,arret:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEAOk7SATBBQjgpQmDCCRhh6ggIQg`,ticks:413,entryTick:0,exitTick:406,exit:`course`,fastest:406,gigue:[995,940,845],raccord:null,exigence:2},course:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEEcgjaAe4EGp4DEn6aEghC`,ticks:490,entryTick:17,exitTick:483,exit:`course`,fastest:466,gigue:[1e3,970,820],raccord:1e3,exigence:2},plein:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjEIugGGAzK2CUI`,ticks:235,entryTick:11,exitTick:231,exit:`plein`,fastest:220,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ff789881`,arret:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIAUk7CAShBQjgpQkgZwgkgYeIICEI`,ticks:413,entryTick:0,exitTick:406,exit:`course`,fastest:406,gigue:[1e3,975,890],raccord:null,exigence:2},course:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIEcgjaAd4EKp4DCn6iEghC`,ticks:490,entryTick:17,exitTick:483,exit:`course`,fastest:466,gigue:[1e3,945,770],raccord:1e3,exigence:2},plein:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjIIugGGAzK2CUI`,ticks:235,entryTick:11,exitTick:231,exit:`plein`,fastest:220,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ec396946`,arret:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMASlbCAShBQjgpQkghugkQYfIICEI`,ticks:413,entryTick:0,exitTick:406,exit:`course`,fastest:406,gigue:[1e3,970,865],raccord:null,exigence:2},course:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMEcgjaAd4EIqYDEnaiEghC`,ticks:490,entryTick:17,exitTick:483,exit:`course`,fastest:466,gigue:[1e3,955,765],raccord:1e3,exigence:2},plein:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjMIugGGAzK2CUI`,ticks:235,entryTick:11,exitTick:231,exit:`plein`,fastest:220,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`a7a1f7c3`,arret:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQASn6iASBBQkDBAd4IKEXCBiTqAg`,ticks:401,entryTick:0,exitTick:394,exit:`course`,fastest:394,gigue:[655,565,545],raccord:null,exigence:5},course:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQEcgjSAaYEEp4RGEIIQg`,ticks:406,entryTick:17,exitTick:400,exit:`course`,fastest:381,gigue:[1e3,1e3,995],raccord:1e3,exigence:1},plein:{code:`AQQabW9kdWxlOnJlc3NvcnRzLWVzY2FsaWVyOjQIwgH-ByLmByRmCEo`,ticks:305,entryTick:11,exitTick:298,exit:`course`,fastest:287,gigue:[1e3,865,825],raccord:1e3,exigence:2}}]},"saut-long":{variants:[{grid:`86770dd0`,arret:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzowAMIFRqIFJtIF`,ticks:274,entryTick:0,exitTick:269,exit:`plein`,fastest:269,gigue:[805,600,430],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzowBHIIMh7aA5YB2gV2GIIEJtoCEEI`,ticks:330,entryTick:17,exitTick:323,exit:`course`,fastest:306,gigue:[1e3,995,765],raccord:1e3,exigence:2},plein:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzowCIoCVoIEProF`,ticks:201,entryTick:11,exitTick:197,exit:`plein`,fastest:186,gigue:[1e3,1e3,830],raccord:1e3,exigence:2}},{grid:`5b388501`,arret:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzoxANoFZrIFRvoF`,ticks:292,entryTick:0,exitTick:287,exit:`plein`,fastest:287,gigue:[1e3,705,535],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzoxBHIIigRuwgVGggY`,ticks:285,entryTick:17,exitTick:280,exit:`plein`,fastest:263,gigue:[750,435,280],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzoxCOICVoIERsoF`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,910],raccord:1e3,exigence:1}},{grid:`c9e0066d`,arret:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzoyALIFdrIDPa4BkgWmAfoDzgcIQg`,ticks:477,entryTick:0,exitTick:470,exit:`course`,fastest:470,gigue:[1e3,1e3,855],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzoyBHIIigSeAboFpgGSBg`,ticks:304,entryTick:17,exitTick:299,exit:`plein`,fastest:282,gigue:[920,725,595],raccord:1e3,exigence:3},plein:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzoyCKIDTroE1gUy`,ticks:228,entryTick:11,exitTick:224,exit:`plein`,fastest:213,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`03afc361`,arret:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzozANoFZrIFRvoF`,ticks:292,entryTick:0,exitTick:287,exit:`plein`,fastest:287,gigue:[1e3,680,490],raccord:null,exigence:3},course:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzozBHIIigRuwgVGggY`,ticks:285,entryTick:17,exitTick:280,exit:`plein`,fastest:263,gigue:[825,435,360],raccord:1e3,exigence:4},plein:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzozCPICRvIDVsoF`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,975],raccord:1e3,exigence:1}},{grid:`a95218a1`,arret:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzo0AMIFTsoEFsoG`,ticks:277,entryTick:0,exitTick:273,exit:`plein`,fastest:273,gigue:[1e3,870,720],raccord:null,exigence:2},course:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzo0BHII4gNW6gQmwgY`,ticks:270,entryTick:17,exitTick:266,exit:`plein`,fastest:249,gigue:[780,595,500],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzo0CJoDJsICJrIG`,ticks:201,entryTick:11,exitTick:197,exit:`plein`,fastest:186,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}},{grid:`5d52fbed`,arret:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzo1AMIFRqIFJtIF`,ticks:274,entryTick:0,exitTick:269,exit:`plein`,fastest:269,gigue:[760,550,425],raccord:null,exigence:5},course:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzo1BHIImgQ-6gQ-8gU`,ticks:267,entryTick:17,exitTick:262,exit:`plein`,fastest:244,gigue:[590,430,270],raccord:1e3,exigence:5},plein:{code:`AQQSbW9kdWxlOnNhdXQtbG9uZzo1CIICZvoDRrIF`,ticks:201,entryTick:11,exitTick:197,exit:`plein`,fastest:186,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}}]},"saut-plafond":{variants:[{grid:`fb40d9d4`,arret:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDowAOIEhgUi5gQ6`,ticks:243,entryTick:0,exitTick:239,exit:`plein`,fastest:239,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDowBHIIkgOmBSLmBDo`,ticks:236,entryTick:17,exitTick:232,exit:`plein`,fastest:215,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDowCIIBNsoDxgVC`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,1e3,855],raccord:1e3,exigence:2}},{grid:`da9f51ee`,arret:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDoxAOIEpgUipgVC`,ticks:256,entryTick:0,exitTick:251,exit:`plein`,fastest:251,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDoxBHIIwgOmBTKmBTI`,ticks:251,entryTick:17,exitTick:247,exit:`plein`,fastest:226,gigue:[1e3,1e3,940],raccord:1e3,exigence:1},plein:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDoxCMoBjgQqpgVK`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,1e3,815],raccord:1e3,exigence:2}},{grid:`54a30d00`,arret:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDoyAPIENvIENsIEMEI`,ticks:254,entryTick:0,exitTick:247,exit:`course`,fastest:246,gigue:[1e3,1e3,970],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDoyBHII8gIm-gU2ggQYWg`,ticks:244,entryTick:17,exitTick:237,exit:`course`,fastest:222,gigue:[965,900,835],raccord:920,exigence:2},plein:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDoyCFo-qgNGggY`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,940,705],raccord:1e3,exigence:2}},{grid:`75936bd0`,arret:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDozAOIEpgUipgVC`,ticks:256,entryTick:0,exitTick:252,exit:`plein`,fastest:252,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDozBHIIkgOGBgoeogU`,ticks:249,entryTick:17,exitTick:244,exit:`plein`,fastest:227,gigue:[890,625,505],raccord:1e3,exigence:3},plein:{code:`AQQVbW9kdWxlOnNhdXQtcGxhZm9uZDozCNIB1gMq1gVK`,ticks:188,entryTick:11,exitTick:184,exit:`plein`,fastest:173,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-ronde":{variants:[{grid:`14311a20`,arret:{code:`AQQTbW9kdWxlOnNjaWUtcm9uZGU6MADCBMYHMg`,ticks:198,entryTick:0,exitTick:194,exit:`plein`,fastest:193,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQTbW9kdWxlOnNjaWUtcm9uZGU6MARyCJIDpgdK`,ticks:190,entryTick:17,exitTick:185,exit:`plein`,fastest:168,gigue:[1e3,1e3,910],raccord:1e3,exigence:1},plein:{code:`AQQTbW9kdWxlOnNjaWUtcm9uZGU6MAhiYIICnggq`,ticks:192,entryTick:11,exitTick:188,exit:`plein`,fastest:177,gigue:[1e3,985,925],raccord:1e3,exigence:1}},{grid:`bf3a98c2`,arret:{code:`AQQTbW9kdWxlOnNjaWUtcm9uZGU6MQDSBI4HKVo`,ticks:203,entryTick:0,exitTick:196,exit:`course`,fastest:196,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQTbW9kdWxlOnNjaWUtcm9uZGU6MQRyCJoDlgcoUg`,ticks:195,entryTick:17,exitTick:188,exit:`course`,fastest:171,gigue:[1e3,820,780],raccord:1e3,exigence:2},plein:{code:`AQQTbW9kdWxlOnNjaWUtcm9uZGU6MQjyAWBSHuIICEI`,ticks:204,entryTick:11,exitTick:198,exit:`course`,fastest:187,gigue:[555,490,340],raccord:1e3,exigence:5}}]},"scie-sol":{variants:[{grid:`9fb722ea`,arret:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjAA4gamAyLmAyRS`,ticks:238,entryTick:0,exitTick:231,exit:`course`,fastest:231,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjAEcgiqBd4DGj7iAiFi`,ticks:229,entryTick:17,exitTick:222,exit:`course`,fastest:205,gigue:[870,820,635],raccord:960,exigence:2},plein:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjAIwgP-BkI`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`6381d1a2`,arret:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjEAsgauAxK-BEo`,ticks:237,entryTick:0,exitTick:232,exit:`plein`,fastest:232,gigue:[1e3,770,690],raccord:null,exigence:2},course:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjEEcgiSBKYECt4EMg`,ticks:231,entryTick:17,exitTick:227,exit:`plein`,fastest:210,gigue:[1e3,960,895],raccord:1e3,exigence:2},plein:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjEI8gLeAgpO4gQ`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,970,775],raccord:1e3,exigence:2}},{grid:`86754e26`,arret:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjIAygWOAwr-BUo`,ticks:243,entryTick:0,exitTick:239,exit:`plein`,fastest:238,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},course:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjIEcgiKBO4CKo4GSg`,ticks:236,entryTick:17,exitTick:232,exit:`plein`,fastest:214,gigue:[1e3,940,775],raccord:1e3,exigence:2},plein:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjIIsgLWAhqmBUI`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`aec748a4`,arret:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjMAsga2Awq-BEo`,ticks:237,entryTick:0,exitTick:232,exit:`plein`,fastest:232,gigue:[1e3,815,625],raccord:null,exigence:2},course:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjMEcgjSBNYCMtYFKg`,ticks:232,entryTick:17,exitTick:228,exit:`plein`,fastest:209,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjMI6gLmAgpO4gQ`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[980,940,750],raccord:1e3,exigence:2}},{grid:`834bf66e`,arret:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjQAsgauAxJO8gMwSg`,ticks:243,entryTick:0,exitTick:236,exit:`course`,fastest:235,gigue:[1e3,820,680],raccord:null,exigence:2},course:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjQEcgjSBL4DIi6SBBBBQg`,ticks:237,entryTick:17,exitTick:230,exit:`course`,fastest:213,gigue:[975,855,745],raccord:960,exigence:2},plein:{code:`AQQRbW9kdWxlOnNjaWUtc29sOjQI6gLeAhpG4gQ`,ticks:175,entryTick:11,exitTick:171,exit:`plein`,fastest:160,gigue:[1e3,970,635],raccord:1e3,exigence:2}}]},"scies-jumelles":{variants:[{grid:`691777e5`,arret:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAAqgKeBSqmAaoGCCoISg`,ticks:262,entryTick:0,exitTick:255,exit:`course`,fastest:251,gigue:[1e3,960,800],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAEcghq1gHaA74BOPYFJCZa`,ticks:256,entryTick:17,exitTick:249,exit:`course`,fastest:232,gigue:[1e3,1e3,920],raccord:920,exigence:1},plein:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjAIigHeAcoCHpoE`,ticks:155,entryTick:11,exitTick:151,exit:`plein`,fastest:140,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`7cbeccc5`,arret:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEAggRm4gOWAboFGEI`,ticks:252,entryTick:0,exitTick:245,exit:`course`,fastest:245,gigue:[1e3,745,690],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEEcgiqAmaKBG66BQgaCEo`,ticks:243,entryTick:17,exitTick:236,exit:`course`,fastest:219,gigue:[890,910,850],raccord:920,exigence:2},plein:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjEIwgHuBzI`,ticks:155,entryTick:11,exitTick:151,exit:`plein`,fastest:140,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`f53a9ae7`,arret:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIAqgKeBRqmAboGCCoISg`,ticks:262,entryTick:0,exitTick:255,exit:`course`,fastest:251,gigue:[1e3,1e3,915],raccord:null,exigence:1},course:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIEcghqzgHSA84BOPYFJCZa`,ticks:256,entryTick:17,exitTick:249,exit:`course`,fastest:232,gigue:[1e3,995,890],raccord:920,exigence:2},plein:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjIIigHWAdICFqIE`,ticks:155,entryTick:11,exitTick:151,exit:`plein`,fastest:140,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}},{grid:`a13cdb87`,arret:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjMA8gNm-gN22gUQSg`,ticks:253,entryTick:0,exitTick:246,exit:`course`,fastest:246,gigue:[1e3,915,835],raccord:null,exigence:2},course:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjMEcgj6AWa6BGbiBQhS`,ticks:244,entryTick:17,exitTick:237,exit:`course`,fastest:220,gigue:[840,800,775],raccord:960,exigence:2},plein:{code:`AQQXbW9kdWxlOnNjaWVzLWp1bWVsbGVzOjMIwgHeB0I`,ticks:155,entryTick:11,exitTick:151,exit:`plein`,fastest:140,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},toboggan:{variants:[{grid:`f21c0c1f`,arret:{code:`AQQRbW9kdWxlOnRvYm9nZ2FuOjAAogQmogUm-gQuwgYgQg`,ticks:360,entryTick:0,exitTick:353,exit:`course`,fastest:353,gigue:[550,410,385],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOnRvYm9nZ2FuOjAEcgjyAiaCBSaaBS7CBihS`,ticks:356,entryTick:17,exitTick:349,exit:`course`,fastest:332,gigue:[640,400,265],raccord:1e3,exigence:5},plein:{code:`AQQRbW9kdWxlOnRvYm9nZ2FuOjAIWmbSBTbqBg`,ticks:228,entryTick:11,exitTick:224,exit:`plein`,fastest:213,gigue:[905,515,400],raccord:1e3,exigence:4}},{grid:`c21aad45`,arret:{code:`AQQRbW9kdWxlOnRvYm9nZ2FuOjEA4gMeqgMeygP2ARi6BC66AyaCBghK`,ticks:450,entryTick:0,exitTick:443,exit:`course`,fastest:443,gigue:[590,315,190],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOnRvYm9nZ2FuOjEEcgiCAjaiAjFSMQ6SBKYBmgUILIoDYTpeKpYECEo`,ticks:447,entryTick:17,exitTick:440,exit:`course`,fastest:418,gigue:[570,215,125],raccord:960,exigence:5},plein:{code:`AQQRbW9kdWxlOnRvYm9nZ2FuOjEIWl66BB6KBDaqBg`,ticks:268,entryTick:11,exitTick:264,exit:`plein`,fastest:253,gigue:[865,530,400],raccord:1e3,exigence:4}}]},tremplin:{variants:[{grid:`6eca0fbd`,arret:{code:`AQQRbW9kdWxlOnRyZW1wbGluOjAA2gMm6gEg5gUiJuIBZSCiBCbCAiFa`,ticks:367,entryTick:0,exitTick:360,exit:`course`,fastest:360,gigue:[560,515,365],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOnRyZW1wbGluOjAEcggSELoCtgGyBoYBwgY`,ticks:302,entryTick:17,exitTick:298,exit:`plein`,fastest:285,gigue:[995,950,805],raccord:1e3,exigence:2},plein:{code:`AQQRbW9kdWxlOnRyZW1wbGluOjAIWp4BkgU-ggY`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,925],raccord:1e3,exigence:1}},{grid:`2e6c3461`,arret:{code:`AQQRbW9kdWxlOnRyZW1wbGluOjEA2gMm6gEg5gUqpgHCBRAKJsICIVo`,ticks:363,entryTick:0,exitTick:356,exit:`course`,fastest:356,gigue:[615,385,345],raccord:null,exigence:5},course:{code:`AQQRbW9kdWxlOnRyZW1wbGluOjEEcggSCMICxgGaBlb6Bg`,ticks:302,entryTick:17,exitTick:298,exit:`plein`,fastest:284,gigue:[1e3,1e3,935],raccord:1e3,exigence:1},plein:{code:`AQQRbW9kdWxlOnRyZW1wbGluOjEImgF24gNWggc`,ticks:215,entryTick:11,exitTick:211,exit:`plein`,fastest:200,gigue:[1e3,1e3,885],raccord:1e3,exigence:2}}]},"tunnel-scies":{variants:[{grid:`645a66bb`,arret:{code:`AQQVbW9kdWxlOnR1bm5lbC1zY2llczowANIBJooDJuoCRpoDVrICngQSVqoCLYICIWYKPuoCtgESPkQRdgpeJQp-Ch5kCR1mIiZFIkbiASaiAiFa`,ticks:687,entryTick:0,exitTick:680,exit:`course`,fastest:680,gigue:[1e3,530,230],raccord:null,exigence:4},course:{code:`AQQVbW9kdWxlOnR1bm5lbC1zY2llczowBHII6gHuAxJ-sgN2qgMOwgIuwgLmAwgM0gLGAQpeChZsCmYKFmQKXgo-JCUKZgo2ISKGAYIECEo`,ticks:659,entryTick:17,exitTick:652,exit:`course`,fastest:635,gigue:[820,435,175],raccord:1e3,exigence:4},plein:{code:`AQQVbW9kdWxlOnR1bm5lbC1zY2llczowCKoBxgMShgGaBu4DCs4BCi4KHlQIbBF1Cj4kCh5kCl4KPiQ2ClbKAWbaAg`,ticks:480,entryTick:11,exitTick:474,exit:`course`,fastest:463,gigue:[945,650,375],raccord:1e3,exigence:3}},{grid:`e702a570`,arret:{code:`AQQVbW9kdWxlOnR1bm5lbC1zY2llczoxAOoBFuoCxgMytgMytgMytgMyVroD3gMahgE8ClYJNTQILDYILDUILDYILDUIJEYJhQEKLjS6AWaiAghC`,ticks:662,entryTick:0,exitTick:655,exit:`course`,fastest:655,gigue:[925,575,350],raccord:null,exigence:4},course:{code:`AQQVbW9kdWxlOnR1bm5lbC1zY2llczoxBHII2gG-AxqGAeoDxgTyAkayAma6Bd4BGj4tCBReCiZEFQpuCl4lCR1mCh5kCR1G0gE2ogIgQg`,ticks:665,entryTick:17,exitTick:659,exit:`course`,fastest:642,gigue:[950,575,325],raccord:1e3,exigence:4},plein:{code:`AQQVbW9kdWxlOnR1bm5lbC1zY2llczoxCFq2BApuogXmBArOAQoWCkZECGwJHWQKHkQKHmQKXgo-JCYihgUISg`,ticks:481,entryTick:11,exitTick:474,exit:`course`,fastest:459,gigue:[985,890,375],raccord:1e3,exigence:3}}]},tunnel:{variants:[{grid:`54d03cf7`,arret:{code:`AQQPbW9kdWxlOnR1bm5lbDowAKIEXtoDxgQIKghK`,ticks:226,entryTick:0,exitTick:219,exit:`course`,fastest:219,gigue:[1e3,960,780],raccord:null,exigence:2},course:{code:`AQQPbW9kdWxlOnR1bm5lbDowBHII4gJe6gPGBAgqCEo`,ticks:219,entryTick:17,exitTick:212,exit:`course`,fastest:195,gigue:[1e3,795,655],raccord:1e3,exigence:2},plein:{code:`AQQPbW9kdWxlOnR1bm5lbDowCHJu4gLmA1I`,ticks:141,entryTick:11,exitTick:137,exit:`plein`,fastest:126,gigue:[1e3,1e3,890],raccord:1e3,exigence:2}},{grid:`aafc0da5`,arret:{code:`AQQPbW9kdWxlOnR1bm5lbDoxAJIEZuIDhgMqvgMIWghC`,ticks:267,entryTick:0,exitTick:261,exit:`course`,fastest:260,gigue:[1e3,925,790],raccord:null,exigence:2},course:{code:`AQQPbW9kdWxlOnR1bm5lbDoxBHII4gJe4gOOAwreAzQ2CEI`,ticks:260,entryTick:17,exitTick:254,exit:`course`,fastest:237,gigue:[1e3,805,705],raccord:1e3,exigence:2},plein:{code:`AQQPbW9kdWxlOnR1bm5lbDoxCHpu2gPmBCo`,ticks:168,entryTick:11,exitTick:164,exit:`plein`,fastest:153,gigue:[1e3,1e3,835],raccord:1e3,exigence:2}},{grid:`1e7a7b4b`,arret:{code:`AQQPbW9kdWxlOnR1bm5lbDoyAJIEZuIDhgMyNrIDMEI`,ticks:266,entryTick:0,exitTick:259,exit:`course`,fastest:259,gigue:[1e3,915,750],raccord:null,exigence:2},course:{code:`AQQPbW9kdWxlOnR1bm5lbDoyBHII2gKGAZoDjgMyLpIECEo`,ticks:261,entryTick:17,exitTick:254,exit:`course`,fastest:237,gigue:[890,775,650],raccord:920,exigence:2},plein:{code:`AQQPbW9kdWxlOnR1bm5lbDoyCHpu0gNOygQ`,ticks:168,entryTick:11,exitTick:164,exit:`plein`,fastest:153,gigue:[1e3,1e3,925],raccord:1e3,exigence:1}}]}}},De=[`mural`,`precision`,`vertical`,`scie`,`friable`,`ressort`,`respiration`,`elan`],q=[`plafond`,`fosse`,`sol-friable`,`patrouille`,`garde`,`ressort`,`denivele`],J=[`arret`,`course`,`plein`];var Y=class extends Error{constructor(e){super(e),this.name=`ModuleError`}};let Oe=/* @__PURE__ */ new Set([`id`,`intention`,`etiquettes`,`famille`,`enchainement`,`mutateurs`,`format`,`paliers`,`repeter`,`variante`]);function ke(e){let t=/^(\d+)(?:-(\d+))?$/.exec(e);if(!t)return null;let n=Number(t[1]),r=t[2]===void 0?n:Number(t[2]);return n<=r?[n,r]:null}function Ae(e,t,n,r){let i=e[1];q.includes(i)||r(`zone « ${e[1]} » : mutateur inconnu (${q.join(`, `)})`);let a=e=>{let n=e===void 0?null:ke(e);return(!n||n[1]>=t)&&r(`zone ${i} : colonnes « ${e} » hors du gabarit`),n},o=e=>{let t=e===void 0?null:ke(e);return(!t||t[1]>=n)&&r(`zone ${i} : rangées « ${e} » hors du gabarit`),t},s=(e,t,n=``)=>({name:i,c0:e[0],c1:e[1],r0:t[0],r1:t[1],extra:n});switch(i){case`plafond`:case`fosse`:case`sol-friable`:case`ressort`:return e.length!==4&&r(`« zone ${i} <colonnes> <rangée> » attendu`),s(a(e[2]),o(e[3]));case`garde`:return(e.length!==5||e[4].length!==1||!`<>^v`.includes(e[4]))&&r(`« zone garde <colonnes> <rangées> <pic : < > ^ v> » attendu`),s(a(e[2]),o(e[3]),e[4]);case`denivele`:{e.length!==3&&r(`« zone denivele <colonnes> » attendu`);let i=a(e[2]);return i[1]!==t-1&&r(`zone denivele : elle va jusqu'à la dernière colonne (la sortie)`),s(i,[0,n-1])}case`patrouille`:return e.length<7&&r(`« zone patrouille <rayon> <cycle> <mode> <c,r> <c,r>… » attendu`),s([0,t-1],[0,n-1],e.slice(2).join(` `))}}let je=/^[#.^v<>oOx*]+$/;function Me(e){let t=e.replace(/\r/g,``).split(`
`),n=0,r={};for(;n<t.length;n++){let e=t[n].trim();if(e===``||e.startsWith(`//`))continue;if(e===`grille:`)break;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(i&&i[1]===`elan`)throw new Y(`Ligne ${n+1} : « elan: oui » est remplacé par l'étiquette « elan » (lot 8c)`);if(!i||!Oe.has(i[1]))throw new Y(`Ligne ${n+1} : « clé: valeur » attendu (${[...Oe].join(`, `)}, puis « grille: »)`);(r[i[1]]??=[]).push(i[2].trim())}if(n>=t.length)throw new Y(`« grille: » manquant`);let i=e=>{let t=r[e];if(!t||t.length!==1||t[0]===``)throw new Y(`« ${e}: » attendu une fois`);return t[0]},a=i(`id`);if(!/^[a-z0-9-]{1,24}$/.test(a))throw new Y(`id « ${a} » invalide (minuscules, chiffres, tirets, 24 au plus)`);let o=e=>`Morceau « ${a} » : ${e}`,s=i(`intention`),c=i(`etiquettes`).split(/\s+/);for(let e of c)if(!De.includes(e))throw new Y(o(`étiquette « ${e} » inconnue (${De.join(`, `)})`));if(new Set(c).size!==c.length)throw new Y(o(`étiquette en double`));if(i(`format`)!==`3`)throw new Y(o(`format ${i(`format`)} : seul le format 3 (paliers posés, famille et mutateurs, lot 7) est lu`));let l=i(`famille`);if(!/^[a-z0-9-]{1,24}$/.test(l))throw new Y(o(`famille « ${l} » invalide (minuscules, chiffres, tirets)`));let u=((e,t)=>{let n=r[e];if(!n)return!1;if(n.length!==1||n[0]!==t)throw new Y(o(`« ${e}: ${t} » attendu (ou rien)`));return!0})(`enchainement`,`long`),d=c.includes(`elan`),f=(r.mutateurs??[]).flatMap(e=>e.split(/\s+/)).filter(Boolean);for(let e of f)if(!q.includes(e))throw new Y(o(`mutateur « ${e} » inconnu (${q.join(`, `)})`));if(new Set(f).size!==f.length)throw new Y(o(`mutateur en double`));let p=/^(\d+)\s+(\d+)$/.exec(i(`paliers`));if(!p)throw new Y(o(`« paliers: <rangée du sol à l'entrée> <rangée du sol à la sortie> » attendu`));n++;let m=[];for(;n<t.length&&t[n].trim()!==``;n++)m.push(t[n].trim());let h=t.slice(n).map(e=>e.trim()).filter(e=>e!==``&&!e.startsWith(`//`)),_=h.filter(e=>!e.startsWith(`zone `));if(m.length===0)throw new Y(o(`grille vide`));let v=m[0].length;m.forEach((e,t)=>{if(e.length!==v)throw new Y(o(`rangée ${t} : ${e.length} colonnes au lieu de ${v}`));if(!je.test(e))throw new Y(o(`rangée ${t} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`))});let y=Number(p[1]),b=Number(p[2]);if(y>=m.length||b>=m.length)throw new Y(o(`rangée de palier hors de la grille`));if(y<4||b<4)throw new Y(o(`rangée de palier sous la 4e : moins de 4 rangées libres au-dessus`));let x=[],S=(r.repeter??[]).map(e=>{let t=/^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(e);if(!t)throw new Y(o(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${e} »)`));let n={param:t[1],axis:t[2],from:Number(t[3]),to:Number(t[4])},r=n.axis===`colonnes`?v:m.length;if(n.from>n.to||n.to>=r)throw new Y(o(`plage ${n.from}-${n.to} hors du gabarit`));return x.includes(n.param)||x.push(n.param),n});for(let e of S)for(let t of S)if(e!==t&&e.axis===t.axis&&e.from<=t.to&&t.from<=e.to)throw new Y(o(`les plages ${e.from}-${e.to} et ${t.from}-${t.to} se chevauchent`));for(let e of h)for(let t of e.matchAll(/\{([a-z][a-z0-9]*)\}/g))x.includes(t[1])||x.push(t[1]);let C=e=>{throw new Y(o(e))},w=h.filter(e=>e.startsWith(`zone `)).map(e=>Ae(e.split(/\s+/),v,m.length,C));for(let e of f)w.some(t=>t.name===e)||C(`mutateur « ${e} » sans zone`);for(let e of w)f.includes(e.name)||C(`zone ${e.name} : mutateur absent de « mutateurs: »`);for(let e of[y,b])if(S.some(t=>t.axis===`rangees`&&e>=t.from&&e<=t.to))throw new Y(o(`une rangée de palier ne se répète pas`));let T=[],E=(r.variante??[]).map((e,t)=>{let n={},r=[];T.push(r);for(let i of e.split(/\s+/).filter(Boolean)){if(i.startsWith(`+`)){let e=/^\+([a-z-]+)(?::(-?[a-z0-9]+))?$/.exec(i);(!e||!f.includes(e[1]))&&C(`variante ${t} : mutateur « ${i} » non accepté (${f.join(`, `)||`aucun`})`);let n=e[1],a=e[2]??``;(n===`plafond`?a===``||a===`nu`||a===`pics`:n===`denivele`?/^-?[1-9]\d?$/.test(a):n===`patrouille`?a===``||/^[1-9]\d{0,4}$/.test(a):a===``)||C(`variante ${t} : argument « ${a} » de ${n} invalide`),r.some(e=>e.name===n)&&C(`variante ${t} : ${n} deux fois`),r.push({name:n,arg:a});continue}let e=/^([a-z][a-z0-9]*)=(\d+)$/.exec(i);if(!e)throw new Y(o(`variante ${t} : « nom=valeur » attendu (« ${i} »)`));if(!x.includes(e[1]))throw new Y(o(`variante ${t} : paramètre « ${e[1]} » inconnu`));let a=Number(e[2]),s=S.some(t=>t.param===e[1])?40:g;if(a>s)throw new Y(o(`variante ${t} : ${e[1]} = ${a} (au plus ${s})`));n[e[1]]=a}for(let e of x)if(n[e]===void 0)throw new Y(o(`variante ${t} : « ${e} » manque`));return r.length>2&&C(`variante ${t} : au plus 2 mutateurs`),n});if(E.length===0)throw new Y(o(`au moins une « variante: » (même sans paramètre)`));return E.length>6&&C(`${E.length} variantes (au plus 6)`),new Set(E.map((e,t)=>JSON.stringify([e,T[t]]))).size!==E.length&&C(`deux variantes identiques`),{id:a,intention:s,tags:c,family:l,long:u,elan:d,mutators:f,zones:w,mutations:T,entryRow:y,exitRow:b,repeats:S,params:x,variants:E,grid:m,annex:_,text:e}}function Ne(e,t){let n=e.grid.map(e=>e.split(``)),r=[...e.annex],i=null,a=t=>{throw new Y(`Morceau « ${e.id} » : ${t}`)},o=(e,t)=>n[t][e],s=(e,t,r)=>{n[t][e]=r},c=0;for(let l of t){let t=e.zones.filter(e=>e.name===l.name);for(let e of t){let t=`${l.name} (colonnes ${e.c0}-${e.c1})`;switch(l.name){case`plafond`:for(let n=e.c0;n<=e.c1;n++)for(let r=0;r<=e.r0;r++)o(n,r)!==`.`&&o(n,r)!==`#`&&a(`${t} : tuile (${n}, ${r}) « ${o(n,r)} » sous le plafond`),s(n,r,r===e.r0&&l.arg===`pics`?`v`:`#`);break;case`fosse`:{let r=[];for(let t=e.c0;t<=e.c1;t++)r.push(o(t,e.r0)===`^`);if(r.every(Boolean))for(let t=e.c0;t<=e.c1;t++)for(let r=e.r0;r<n.length;r++)s(t,r,`.`);else for(let r=e.c0;r<=e.c1;r++){for(let i=e.r0;i<n.length;i++)o(r,i)!==`.`&&a(`${t} : ni fond de pics ni fond vide (tuile (${r}, ${i}))`);s(r,e.r0,`^`);for(let t=e.r0+1;t<n.length;t++)s(r,t,`#`)}break}case`sol-friable`:case`ressort`:for(let n=e.c0;n<=e.c1;n++)o(n,e.r0)!==`#`&&a(`${t} : tuile (${n}, ${e.r0}) « ${o(n,e.r0)} » au lieu d'un bloc`),s(n,e.r0,l.name===`ressort`?`*`:`x`);break;case`garde`:for(let n=e.c0;n<=e.c1;n++)for(let r=e.r0;r<=e.r1;r++)o(n,r)!==`.`&&a(`${t} : tuile (${n}, ${r}) occupée`),s(n,r,e.extra);break;case`patrouille`:{let t=e.extra.split(` `);l.arg&&(t[1]=l.arg),r.push(`scie mutee${c++||``} ${t.join(` `)}`);break}case`denivele`:i={from:e.c0,k:Number(l.arg)};for(let n of r)for(let r of n.split(/\s+/).slice(5))Number(/^(\d+)/.exec(r)?.[1]??-1)>=e.c0&&a(`${t} : une scie y passe`)}}}return{grid:n.map(e=>e.join(``)),annex:r,denivele:i}}function Pe(e,t,n){let r=[],i=Array(e).fill(-1),a=Array(e).fill(-1);for(let o=0;o<e;){let e=t.find(e=>e.from===o),s=e?e.to:o,c=e?n[e.param]:1;for(let e=0;e<c;e++)for(let t=o;t<=s;t++)e===0&&(i[t]=r.length),a[t]=r.length,r.push(t);o=s+1}return{src:r,first:i,last:a}}function X(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t.toString(16).padStart(8,`0`)}let Fe=(e,t)=>e<t?`.`:`#`;function Ie(e,t,n={}){let r=e.variants[t];if(!r)throw new Y(`Morceau « ${e.id} » : pas de variante ${t} (0 à ${e.variants.length-1})`);let i=n.lancement??0;if(!Number.isInteger(i)||i<0||i>40)throw new Y(`lancement : de 0 à 40 colonnes`);let a=n=>`Morceau « ${e.id} », variante ${t} : ${n}`,o=e.mutations[t]??[],s;try{s=Ne(e,o)}catch(e){throw e instanceof Y?new Y(a(e.message)):e}let c=Pe(s.grid[0].length,e.repeats.filter(e=>e.axis===`colonnes`),r),l=Pe(s.grid.length,e.repeats.filter(e=>e.axis===`rangees`),r),u=c.src.length;if(u<1)throw new Y(a(`grille vide`));let d=l.first[e.entryRow],f=l.first[e.exitRow],p=i+1+2,m=p+u+2,h=i>0?0:1,g=l.src.map(e=>c.src.map(t=>s.grid[e][t]));if(s.denivele){let{from:e,k:t}=s.denivele,n=c.src.map(t=>t>=e);if(t>0){let e=g[g.length-1];for(let n=0;n<t;n++)g.push([...e])}else if(f+t<4)throw new Y(a(`dénivelé ${t} : moins de 4 rangées au-dessus de la sortie`));let r=g.length;for(let e=0;e<n.length;e++){if(!n[e])continue;let i=g.map(t=>t[e]);for(let n=0;n<r;n++)g[n][e]=t>0?n>=t?i[n-t]:`.`:n-t<r?i[n-t]:i[r-1]}f+=t}let _=g.map(e=>e.join(``)),v=_.length;if(v>30)throw new Y(a(`${v} rangées (au plus 30)`));let b=_.map((e,t)=>{let n=Fe(t,d).repeat(p),r=t===d-1?n.slice(0,h)+`S`+n.slice(h+1):n,i=Fe(t,f).repeat(3)+(t===f-1?`F`:Fe(t,f));return r+e+i}),x=[`section ${e.id} ${p}-${p+u-1}`];for(let e of s.annex){let t=e.replace(/\{([a-z][a-z0-9]*)\}/g,(e,t)=>String(r[t])).split(/\s+/);if(t[0]!==`scie`)throw new Y(a(`bloc annexe : seules les scies sont permises (« ${t[0]} »)`));x.push(t.map((e,t)=>{let n=t>=5?/^(\d+)('?),(\d+)('?)$/.exec(e):null;if(!n)return e;let r=Number(n[1]),i=Number(n[3]),o=(n[2]?c.last:c.first)[r],s=(n[4]?l.last:l.first)[i];if(o===void 0||s===void 0||o<0||s<0)throw new Y(a(`point ${e} hors de la grille ou retiré par la variante`));return`${o+p},${s}`}).join(` `))}let S=b.join(`
`)+`

`+x.join(`
`)+`
`,C;try{C=T(S)}catch(e){throw e instanceof y?new Y(a(e.message)):e}let w={id:e.id,variant:t,values:r,mutations:o,levelId:`module:${e.id}:${t}`,level:C,ascii:S,hash:X(S),lead:p,width:u,height:v,entryRow:d,exitRow:f,palierIn:{col0:p-2,col1:p-1,row:d},palierOut:{col0:p+u,col1:p+u+2-1,row:f},exitCol:m},E=Le(w);if(E.length>0)throw new Y(a(E.join(` ; `)));return w}function Le(e){let t=[],n=e.level,r=f,i=(e,t)=>n.tiles[t*n.width+e];for(let[a,o]of[[`entrée`,e.palierIn],[`sortie`,e.palierOut]]){o.row<4&&t.push(`palier d'${a} : moins de 4 rangées au-dessus`);for(let e=o.col0;e<=o.col1;e++)for(let r=0;r<n.height;r++){let n=r<o.row?0:1;i(e,r)!==n&&t.push(`palier d'${a} : tuile (${e}, ${r}) ${n===1?`vide`:`occupée`}`)}let e={x:o.col0*r,y:(o.row-4)*r,w:(o.col1-o.col0+1)*r,h:4*r};for(let r of n.saws){let n=r.cycle===0?1:r.cycle;for(let i=0;i<n;i++){let n=D(r,i);if(ae(n.x,n.y,r.radius,e)){t.push(`palier d'${a} : la scie ${r.id} y passe`);break}}}}return m(i(e.lead,e.entryRow-1))&&t.push(`première colonne du morceau pleine au ras du sol : on n'y entre pas en courant`),t}let Re=Te.map(Me);function ze(e){let t=Re.find(t=>t.id===e);if(!t)throw new Y(`Morceau « ${e} » inconnu`);return t}function Be(e,t,n={}){return Ie(ze(e),t,n)}function Ve(e){let t=e===`plein`?I(F):F.runSpeed;return Array.from({length:25},(e,n)=>p((2*n+1)*t,50))}Ve(`course`);function He(e){return O(e.x+p(M,2))}function Ue(e){let t=F;return e.ground!==1||e.vy!==0||e.air!==0||e.wallSide!==0||e.wallAir!==255||e.slide!==0||e.buffer!==0||e.held!==0||e.jumping!==0||e.lock!==0||e.lockDir!==0?null:e.vx===t.runSpeed&&e.sprint===1?`course`:e.vx===I(t)&&e.sprint===t.sprintDelay?`plein`:null}function We(e,t){return Ee.jumpSimVersion===4?Ee.modules[e]?.variants[t]??null:null}function Ge(e){if(!e)return 0;let t=0;for(let n of J){let r=e[n];if(!r||r.exigence===0)return 0;r.exigence>t&&(t=r.exigence)}return t}let Ke=n(2026,10,16);function qe(e){return e-Ke+1}function Je(e){return`jour-${a(e)}-g5`}let Ye=3e3,Xe=4800,Ze=3600,Z=3360,Qe=3840,$e={gold:110,silver:130,bronze:160};function et(e){return Number.parseInt(X(`repos17912:${e}`),16)%7}function tt(e,t){return((e-(4*t%7+7)%7)%7+7)%7<4}function nt(e,t){return!tt(et(e),t)}let rt=(e,t)=>p(e*t+99,100);function it(e){return{author:e,gold:rt(e,$e.gold),silver:rt(e,$e.silver),bronze:rt(e,$e.bronze)}}let at=null;function ot(){return at||(at=Re.map(e=>e.variants.flatMap((t,n)=>{let r=We(e.id,n),i=Ge(r);if(!r||J.some(e=>!r[e])||i<1)return[];let a=Be(e.id,n),o={arret:0,course:0,plein:0},s={arret:`course`,course:`course`,plein:`course`};for(let e of J)o[e]=r[e].exitTick-r[e].entryTick,s[e]=r[e].exit;return[{id:e.id,variant:n,tags:e.tags,family:e.family,long:e.long,exigence:i,ticks:o,exits:s,height:a.height,width:a.width,entryRow:a.entryRow,exitRow:a.exitRow}]})).filter(e=>e.length>0),at)}let Q=(e,t)=>e.tags.includes(t),st=e=>e.choice.ticks[e.entry],ct=e=>e.choice.exits[e.entry];function lt(e){let t=[],n=0;e.forEach((r,i)=>{i>0&&(n=t[i-1]+e[i-1].choice.exitRow-r.choice.entryRow),t.push(n)});let r=0,i=0;return e.forEach((e,n)=>{(n===0||t[n]<r)&&(r=t[n]),(n===0||t[n]+e.choice.height>i)&&(i=t[n]+e.choice.height)}),{tops:t.map(e=>e-r+1),height:i-r+1}}let $=(e,t)=>p(e*1e3,t);function ut(e,t){let n=ot().filter(t=>!nt(t[0].id,e)),r=[],i=/* @__PURE__ */ new Set,a=/* @__PURE__ */ new Set,o=0;for(;;){if(r.length>=15)return`trop de morceaux`;let s=r.length===0?`arret`:ct(r[r.length-1]),c=$(o,Ze),l=r.reduce((e,t)=>e+t.choice.exigence,0)*100,u=c<600?0:p((p(670*o,720)-l)*60,100),d=100+p(240*(c<1e3?c:1e3),1e3)+u,f=r.length>=2&&r.slice(-2).every(e=>Q(e.choice,`precision`)),m=!r.some(e=>Q(e.choice,`mural`)),h=!r.some(e=>Q(e.choice,`scie`)),g=!r.some(e=>Q(e.choice,`elan`)),_=!r.some(e=>Q(e.choice,`respiration`)),v=!r.some(e=>e.choice.exigence>=4),y=r.filter(e=>e.choice.long).length,b=y<1&&c>=300,x=(e,t)=>{let n=o+p(t,2);return n>=p(Qe*350,1e3)&&n<=p(Z*650,1e3)&&Q(e,`respiration`)},S=_&&o+360>p(Z*650,1e3),C=m&&c>=550,w=h&&c>=550,T=g&&c>=450,E=v&&c>=667,D=[];for(let c of n){let n=c[0].id;if(i.has(n)||a.has(c[0].family))continue;let l=c[0].tags;if((c[0].long?y>=2:b&&!S)||f&&l.includes(`precision`)||l.includes(`respiration`)&&!_||S&&!l.includes(`respiration`)||(C||w||T)&&!(C&&l.includes(`mural`)||w&&l.includes(`scie`)||T&&l.includes(`elan`)))continue;let u=c.filter(e=>{let t={choice:e,entry:s},n=st(t)+0;if(Q(e,`respiration`)&&!x(e,n)||E&&e.exigence<4)return!1;let i=o+n;if(i>Qe)return!1;if(i>=Z){let t=[...r.map(e=>e.choice),e];if(!t.some(e=>Q(e,`mural`))||!t.some(e=>Q(e,`scie`))||!t.some(e=>Q(e,`respiration`))||!t.some(e=>Q(e,`elan`))||!t.some(e=>e.exigence>=4)||t.length<6||t.filter(e=>e.long).length<1)return!1}return lt([...r,t]).height<=56});if(u.length===0)continue;let p=[],v=1/0;for(let e of u){let t=Math.abs(e.exigence*100-d);t<v?(v=t,p=[e]):t===v&&p.push(e)}let O=p.length===1?p[0]:t.pick(p),k=v<=50?8:v<=100?5:v<=200?2:1;(m&&Q(O,`mural`)||h&&Q(O,`scie`)||g&&Q(O,`elan`))&&(k*=2),Q(O,`respiration`)&&(k*=4);let A=et(O.id);!tt(A,e-1)&&!tt(A,e+1)&&(k*=2),D.push({pick:{choice:O,entry:s},weight:k})}if(D.length===0){let e=[S&&`respiration`,b&&!S&&`long`,C&&`mural`,w&&`scie`,T&&`elan`,E&&`pointe`].filter(Boolean);return`impasse au morceau ${r.length+1}${e.length?` (imposés : ${e.join(`, `)})`:``}`}let O=0;for(let e of D)O+=e.weight;let k=t.int(O),A=D[0];for(let e of D){if(k<e.weight){A=e;break}k-=e.weight}if(r.push(A.pick),i.add(A.pick.choice.id),a.add(A.pick.choice.family),o+=st(A.pick)+(r.length,0),o>=Z)return r}}function dt(e){let t=ot().flat(),n=[];if(e.forEach((e,r)=>{let i=t.find(t=>t.id===e.id&&t.variant===e.variant);if(!i)throw RangeError(`Morceau « ${e.id} », variante ${e.variant} : pas de solution utilisable`);n.push({choice:i,entry:r===0?`arret`:ct(n[r-1])})}),n.length===0)throw RangeError(`Assemblage vide`);let{tops:r,height:i}=lt(n),a=1+n.reduce((e,t)=>e+t.choice.width,0)+(n.length+1)*2+1,o=[];for(let e=0;e<i;e++)o.push(Array(a).fill(`#`));let s=[],c=[],l=[],u=3;n.forEach((e,t)=>{let n=Be(e.choice.id,e.choice.variant),[a,l=``]=n.ascii.split(`

`),d=a.split(`
`).map(e=>e.slice(n.lead,n.lead+n.width)),f=r[t];for(let e=0;e<d.length;e++)for(let t=0;t<n.width;t++)o[f+e][u+t]=d[e][t];let p=d[d.length-1];for(let e=0;e<n.width;e++)if(p[e]!==`#`)for(let t=f+d.length;t<i;t++)o[t][u+e]=`.`;s.push(`section ${e.choice.id} ${u}-${u+n.width-1}`);for(let t of l.split(`
`)){let r=t.trim().split(/\s+/);r[0]===`scie`&&s.push(r.map((t,r)=>{if(r===1)return`${e.choice.id}/${t}`;let i=r>=5?/^(\d+),(\d+)$/.exec(t):null;return i?`${Number(i[1])-n.lead+u},${Number(i[2])+f}`:t}).join(` `))}c.push({id:e.choice.id,variant:e.choice.variant,entry:e.entry,tags:e.choice.tags,family:e.choice.family,long:e.choice.long,exigence:e.choice.exigence,solutionTicks:st(e),col0:u,col1:u+n.width-1,top:f,entryRow:f+n.entryRow,exitRow:f+n.exitRow,start:0,end:0}),u+=n.width+2});for(let e=0;e<=n.length;e++){let t=c[e-1],r=c[e],a=r?r.entryRow:t.exitRow,s=Math.min(t?t.top:i,r?r.top:i),u=r?r.col0-2:t.col1+1,d=e===0?u-1:u,f=e===n.length?u+2+1:u+2;for(let e=d;e<f;e++)for(let t=s;t<a;t++)o[t][e]=`.`;l.push({col0:u,col1:u+2-1,row:a}),o[a-1][u]=e===0?`S`:e===n.length?`.`:`C`,e===n.length&&(o[a-1][u+2]=`F`)}let d=o.map(e=>e.join(``)).join(`
`)+`

`+s.join(`
`)+`
`;return{level:T(d),ascii:d,pieces:c,paliers:l}}function ft(e){let t=e.level,n=(e,n)=>W(e,n,t,F),r=[],i=[],a=[],o=U(t),s=`arret`;for(let t=0;t<e.pieces.length;t++){let c=e.pieces[t];a.push(s);let l=We(c.id,c.variant)?.[s];if(!l)return`${c.id}:${c.variant} sans solution`;let u=ge(ye(l.code).runs),d=t===e.pieces.length-1,f=d?-1:e.pieces[t+1].col0;i.push(r.length);let p=!1,m=u.length+64;for(let e=t===0?0:l.entryTick;e<m&&!p;e++){let i=e<u.length?u[e]:2;if(o=n(o,i),r.push(i),o.status===2)return`${c.id}:${c.variant} meurt (morceau ${t+1})`;if(o.status===3){if(!d)return`${c.id}:${c.variant} touche l'arrivée (morceau ${t+1})`;p=!0}else if(!d&&He(o.player)>=f){let e=Ue(o.player);if(!e)return`${c.id}:${c.variant} sort hors des états canoniques (morceau ${t+1})`;s=e,p=!0}}if(!p)return`${c.id}:${c.variant} n'aboutit pas (morceau ${t+1})`}return{inputs:r,starts:i,entries:a}}function pt(e,t){let n=0,r=[[0,0],[0,0],[0,0]];for(let i of e){n+=i.exigence;let e=p(i.start+i.end,2),a=e*3<t?0:e*3<t*2?1:2;r[a][0]+=i.exigence*(i.end-i.start),r[a][1]+=i.end-i.start}let i=e=>e[1]===0?0:p(e[0]*10,e[1]);return{sum:n,rate:t>0?p(n*10*60*120,t):0,thirds:[i(r[0]),i(r[1]),i(r[2])]}}function mt(e){let t=[],{pieces:n,authorTicks:r}=e;(r<Ye||r>Xe)&&t.push(`temps de l'auteur ${r} pas hors de [${Ye}, ${Xe}]`),(n.length<6||n.length>15)&&t.push(`${n.length} morceaux (de 6 à 15)`),e.level.height>56&&t.push(`hauteur ${e.level.height} (au plus 56)`),new Set(n.map(e=>e.id)).size!==n.length&&t.push(`morceau en double`),new Set(n.map(e=>e.family)).size!==n.length&&t.push(`famille en double`);let i=n.filter(e=>e.long).length;(i<1||i>2)&&t.push(`${i} enchaînements longs (de 1 à 2)`),e.longestRun>240&&t.push(`course au sol sans saut de ${e.longestRun} pas (au plus 240)`),n.some(e=>e.tags.includes(`mural`))||t.push(`aucun morceau mural`),n.some(e=>e.tags.includes(`scie`))||t.push(`aucun morceau scie`),n.some(e=>e.tags.includes(`elan`))||t.push(`aucun morceau elan`);let a=0;for(let e of n)a=e.tags.includes(`precision`)?a+1:0,a>2&&t.push(`plus de 2 morceaux precision d'affilée`);let o=n.filter(e=>e.tags.includes(`respiration`));o.length!==1&&t.push(`${o.length} morceaux respiration (un seul, au milieu)`);for(let e of o){let n=$(e.start+e.end,2*r);(n<350||n>650)&&t.push(`respiration à ${n} ‰ (entre 350 et 650)`)}(n[0]?.entry!==`arret`||n.slice(1).some(e=>e.entry===`arret`))&&t.push(`entrées : le premier à l'arrêt, les autres lancés (course ou élan plein)`),n.some(e=>e.exigence>=4)||t.push(`aucun morceau d'exigence 4 ou plus`);let s=e.exigence;(s.rate<600||s.rate>740)&&t.push(`exigence ${s.rate} hors de [600, 740]`),s.thirds[2]<s.thirds[0]&&t.push(`le dernier tiers (${s.thirds[2]}) est moins exigeant que le premier (${s.thirds[0]})`),s.thirds[2]<s.thirds[1]&&t.push(`le dernier tiers (${s.thirds[2]}) est moins exigeant que le deuxième (${s.thirds[1]})`);let c=e.palierTicks.reduce((e,t)=>e+t,0);return c*1e3>=60*r&&t.push(`course à vide sur les paliers ${$(c,r)} ‰ (moins de 60 ‰)`),t}function ht(e,t,n){let r=t.slice(1,-1),i=r.map(()=>0),a=U(e);for(let t of n){if(a=W(a,t,e,F),a.status===2)break;if(a.player.ground===1&&!(t&4)){let e=He(a.player);for(let t=0;t<r.length;t++)e>=r[t].col0&&e<=r[t].col1&&i[t]++}if(a.status===3)break}return i}function gt(e,t){let n=U(e),r=0,i=0;for(let a of t)if(n=W(n,a,e,F),n.status===2||(r=n.player.ground===1&&!(a&4)?r+1:0,r>i&&(i=r),n.status===3))break;return i}function _t(e,t){return $(Math.abs(e-Ze),Ze)+$(Math.abs(t-670),670)}function vt(e,t){let n;try{n=dt(e)}catch(e){return`assemblage : ${e.message}`}let r=ft(n);if(typeof r==`string`)return r;let i={simVersion:4,levelId:t,start:{checkpoint:-1,held:0,time:0,sections:[],elan:0},runs:he(r.inputs)},a=we(n.level,i,t);if(!a.finished)return`le rejeu n'arrive pas`;if(a.deaths.length>0)return`le rejeu meurt ${a.deaths.length} fois`;let o=a.time,s=n.pieces.map((e,t)=>{let i=r.entries[t],a=We(e.id,e.variant)[i];return{...e,entry:i,solutionTicks:a.exitTick-a.entryTick,start:r.starts[t],end:t+1<n.pieces.length?r.starts[t+1]:o}}),c={id:t,level:n.level,ascii:n.ascii,hash:X(n.ascii),pieces:s,paliers:n.paliers,palierTicks:ht(n.level,n.paliers,r.inputs),longestRun:gt(n.level,r.inputs),replay:i,code:ve(i),authorTicks:o,medals:it(o),exigence:pt(s,o)};return{built:c,problems:mt(c)}}let yt=[{id:`piliers`,variant:2},{id:`scie-sol`,variant:0},{id:`grand-saut`,variant:3},{id:`puits`,variant:1},{id:`mur-trous`,variant:1},{id:`petits-trous`,variant:1},{id:`ressort-plafond`,variant:1},{id:`iles-scie`,variant:2},{id:`mur-friable`,variant:1},{id:`plafond-pics`,variant:1},{id:`escalier-friable`,variant:2},{id:`saut-long`,variant:2}],bt=/* @__PURE__ */ new Map;function xt(n){let r=bt.get(n);if(r)return r;let i=Je(n),o=t(n,1785689458),s=[],c=null;for(let r=0;r<40&&!(r>=6&&c);r++){let a=ut(n,new e(t(o,r)));if(typeof a==`string`){s.push({index:r,status:`impasse`,reason:a,pieces:[],ticks:0,rate:0,score:0});continue}let l=a.map(e=>`${e.choice.id}:${e.choice.variant}`),u=vt(a.map(e=>({id:e.choice.id,variant:e.choice.variant})),i);if(typeof u==`string`){s.push({index:r,status:`refusé`,reason:u,pieces:l,ticks:0,rate:0,score:0});continue}let{built:d,problems:f}=u,p=_t(d.authorTicks,d.exigence.rate),m=f.length>0?`refusé`:`valide`;s.push({index:r,status:m,reason:f.join(` ; `),pieces:l,ticks:d.authorTicks,rate:d.exigence.rate,score:p}),!(f.length>0)&&(!c||p<c.score)&&(c={built:d,index:r,score:p})}let l;if(c)l={...c.built,day:n,date:a(n),number:qe(n),attempts:s,chosen:c.index,fallback:!1};else{let e=vt(yt,i);if(typeof e==`string`||e.problems.length>0)throw Error(`Niveau de secours invalide : ${typeof e==`string`?e:e.problems.join(` ; `)}`);l={...e.built,day:n,date:a(n),number:qe(n),attempts:s,chosen:-1,fallback:!0}}return bt.set(n,l),l}function St(e){return{format:1,simVersion:4,generatorVersion:5,day:e.day,id:e.id,ascii:e.ascii,hash:e.hash,pieces:e.pieces.map(e=>({...e,tags:[...e.tags]})),paliers:e.paliers.map(e=>({...e})),palierTicks:[...e.palierTicks],longestRun:e.longestRun,code:e.code,authorTicks:e.authorTicks,exigence:{sum:e.exigence.sum,rate:e.exigence.rate,thirds:[...e.exigence.thirds]},attempts:e.attempts.map(e=>({...e,pieces:[...e.pieces]})),chosen:e.chosen,fallback:e.fallback}}function Ct(e){return St(xt(e))}self.onmessage=e=>{let t;try{t={ok:!0,payload:Ct(e.data.day)}}catch(e){t={ok:!1,error:e instanceof Error?e.message:String(e)}}self.postMessage(t)}})();