(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=4096;function t(e,t){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t))throw RangeError(`idiv attend des entiers sûrs (${e}, ${t})`);if(t===0)throw RangeError(`idiv : division par zéro`);return(e-e%t)/t+0}function n(e){return e>=1&&e<=3}function r(e){return e>=4&&e<=7}var i=2048,a=72e3,o=4*e,s=1792,c=5632,l=class extends Error{constructor(e){super(e),this.name=`LevelError`}},u={"#":1,".":0,S:0,F:0,C:0,o:0,O:0,x:2,"*":3,"^":4,v:5,"<":6,">":7},d=t(e,2),f=(t,n)=>({x:t*e+d,y:n*e+d});function p(n,r){let i=/^(\d+)(?:\.(\d{1,6}))?$/.exec(n);if(!i)throw new l(`${r} : « ${n} » n'est pas un nombre de tuiles`);let a=i[2]??``,o=1;for(let e=0;e<a.length;e++)o*=10;return t((Number(i[1])*o+(a?Number(a):0))*e*2+o,o*2)}function m(e,n,r){let i=n===`aller-retour`?[...e,...e.slice(1,-1).reverse()]:[...e],a=[],o=0;for(let e=0;e<i.length;e++){let t=i[e],n=i[(e+1)%i.length],r=(t.x>n.x?t.x-n.x:n.x-t.x)+(t.y>n.y?t.y-n.y:n.y-t.y);a.push(r),o+=r}let s=[0],c=0;for(let e=0;e<i.length;e++)c+=a[e],s.push(o===0?r:t(r*c,o));return{nodes:i,times:s}}function h(e){let t=e.replace(/\r/g,``).split(`
`);for(;t.length>0&&t[0].trim()===``;)t.shift();for(;t.length>0&&t[t.length-1].trim()===``;)t.pop();if(t.length===0)throw new l(`Niveau vide`);let n=t.findIndex(e=>e.trim()===``);n<0&&(n=t.length);let r=t.slice(0,n),d=t.slice(n),h=r[0].length,g=r.length;if(h>2048||g>512)throw new l(`Niveau trop grand (${h} × ${g}, au plus ${i} × 512)`);let _=[],v=[],y=[],b=[],x=[],S=[],C=[];for(let e=0;e<g;e++){let t=r[e];if(t.length!==h)throw new l(`Ligne ${e+1} : ${t.length} colonnes au lieu de ${h}`);for(let n=0;n<h;n++){let r=t[n],i=u[r];if(i===void 0)throw new l(`Ligne ${e+1}, colonne ${n+1} : caractère « ${r} » inconnu`);if(_.push(i),S.push(i===2?x.length:-1),i===2&&x.push({col:n,row:e}),r===`S`&&v.push({col:n,row:e}),r===`F`&&y.push({col:n,row:e}),r===`C`&&C.push({col:n,row:e}),r===`o`||r===`O`){let t=f(n,e);b.push({id:`${r}${b.length}`,radius:r===`o`?s:c,mode:`fixe`,points:[t],cycle:0,section:-1,nodes:[t],times:[0,0]})}}}C.sort((e,t)=>e.col-t.col||e.row-t.row);for(let e=1;e<C.length;e++)if(C[e].col===C[e-1].col)throw new l(`Deux points de passage « C » dans la colonne ${C[e].col+1} (un seul par colonne)`);if(v.length!==1)throw new l(`Il faut exactement un départ « S » (${v.length} trouvés)`);if(y.length!==1)throw new l(`Il faut exactement une arrivée « F » (${y.length} trouvées)`);let w=[],T=[];for(let e=0;e<d.length;e++){let t=d[e].trim();if(t===``||t.startsWith(`//`))continue;let r=t.split(/\s+/),i=`Annexe, ligne ${n+e+1}`;if(r[0]===`section`){let e=r.length===3?/^(\d+)-(\d+)$/.exec(r[2]):null;if(!e)throw new l(`${i} : « section <nom> <col0>-<col1> » attendu`);let t=Number(e[1]),n=Number(e[2]);if(t>n||n>=h)throw new l(`${i} : colonnes ${t}-${n} hors de la grille (0-${h-1})`);if(w.some(e=>e.name===r[1]))throw new l(`${i} : section « ${r[1]} » déjà déclarée`);let a=w.find(e=>t<=e.c1&&e.c0<=n);if(a)throw new l(`${i} : chevauche la section « ${a.name} »`);w.push({name:r[1],c0:t,c1:n})}else if(r[0]===`scie`)T.push({line:n+e+1,words:r});else throw new l(`${i} : déclaration « ${r[0]} » inconnue (section, scie)`)}for(let{line:e,words:t}of T){let n=`Annexe, ligne ${e}`;if(t.length<7)throw new l(`${n} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);let[,r,i,u,d]=t;if(b.some(e=>e.id===r))throw new l(`${n} : scie « ${r} » déjà déclarée`);let _=i===`o`?s:i===`O`?c:p(i,n);if(_<=0||_>o)throw new l(`${n} : rayon hors bornes (au plus 4 tuiles)`);if(!/^\d+$/.test(u)||Number(u)<1||Number(u)>72e3)throw new l(`${n} : cycle en pas attendu (1 à ${a})`);if(d!==`aller-retour`&&d!==`boucle`)throw new l(`${n} : mode « ${d} » inconnu (aller-retour, boucle)`);let v=t.slice(5).map(e=>{let t=/^(\d+),(\d+)$/.exec(e);if(!t)throw new l(`${n} : point « ${e} » (col,rangée) attendu`);let r={col:Number(t[1]),row:Number(t[2])};if(r.col>=h||r.row>=g)throw new l(`${n} : point ${e} hors de la grille`);return r});if(v.length>32)throw new l(`${n} : au plus 32 points`);let y=w.findIndex(e=>v[0].col>=e.c0&&v[0].col<=e.c1);if(y<0)throw new l(`${n} : le premier point (colonne ${v[0].col}) n'est dans aucune section`);let x=v.map(e=>f(e.col,e.row)),S=Number(u);b.push({id:r,radius:_,mode:d,points:x,cycle:S,section:y,...m(x,d,S)})}return{width:h,height:g,tiles:_,start:v[0],finish:y[0],sections:w,saws:b,crumbles:x,crumbleIndex:S,checkpoints:C}}function g(e,t,n){return n>=e.height?0:t<0||n<0||t>=e.width?1:e.tiles[n*e.width+t]}function _(t){return{x:t.col*e,y:t.row*e}}function v(e,n){if(e.cycle===0||n<=0)return e.nodes[0];let r=n%e.cycle,i=e.nodes.length,a=0;for(;a<i-1&&r>=e.times[a+1];)a++;let o=e.nodes[a],s=e.nodes[(a+1)%i],c=e.times[a],l=e.times[a+1]-c;return l<=0?o:{x:o.x+t((s.x-o.x)*(r-c),l),y:o.y+t((s.y-o.y)*(r-c),l)}}var y=12;function b(e){return e>>y}function x(e,t,r,i,a){for(let o=i;o<=a;o++)for(let i=t;i<=r;i++)if(n(g(e,i,o)))return!0;return!1}function S(e,t,n,r,i){return x(e,b(t),b(t+r-1),b(n),b(n+i-1))}function C(t,n,r,i,a,o,s){if(i===0)return{pos:n,blocked:!1};let c=b(a),l=b(a+o-1),u=e=>s?x(t,e,e,c,l):x(t,c,l,e,e);if(i>0){let t=b(n+r-1)+1,a=b(n+r+i-1);for(let n=t;n<=a;n++)if(u(n))return{pos:n*e-r,blocked:!0}}else{let t=b(n)-1,r=b(n+i);for(let n=t;n>=r;n--)if(u(n))return{pos:(n+1)*e,blocked:!0}}return{pos:n+i,blocked:!1}}var w=3072,T=3072,E=2048,D=Object.freeze({runSpeed:375,groundAccel:17,groundDecel:32,airAccel:13,airDecel:6,gravity:19,fallSpeed:751,jumpSpeed:800,jumpCut:340,slideSpeed:171,wallJumpX:340,wallJumpY:680,wallLock:0,wallReach:512,coyote:10,wallCoyote:6,jumpBuffer:12,cornerTolerance:1024,crumbleDelay:30,springSpeed:1056}),O=Object.keys(D);function k(e){return O.every(t=>e[t]===D[t])}function A(n){let r=n.start.col*e+t(e-w,2),i=(n.start.row+1)*e-T,a=+!!S(n,r,i+1,3072,3072);return{x:r,y:i,vx:0,vy:0,ground:a,air:a?0:255,wallSide:0,wallAir:255,slide:0,buffer:0,held:0,jumping:0,lock:0,lockDir:0}}function j(e){return e.ground?`sol`:e.slide===0?`air`:`mur`}var ee=(e,t,n)=>e<t?t:e>n?n:e,M=(e,t,n)=>e<t?e+n>t?t:e+n:e-n<t?t:e-n;function N(t,r,i,a,o){let s=b(i),c=b(i+T-1),l=a<0?r:r+w,u=a<0?b(r)-1:b(r+w-1)+1,d=b(a<0?r-o-1:r+w+o);for(let r=u;a<0?r>=d:r<=d;r+=a)for(let i=s;i<=c;i++)if(n(g(t,r,i)))return a<0?l-(r+1)*e:r*e-l;return-1}function P(t,r,i,a){if(!Number.isInteger(r)||r<0||r>7)throw RangeError(`Commande invalide : ${r}`);let o=a,s=(r&2?1:0)-(r&1?1:0),c=r&4?1:0,l=c===1&&t.held===0;t.lock>0&&s===t.lockDir&&(s=0);let u=t.lock>0?t.lock-1:0,d=u>0?t.lockDir:0,f=t.ground===1,p=f?o.groundAccel:o.airAccel,m=f?o.groundDecel:o.airDecel,h=t.vx;h=s===0?M(h,0,m):h*s<0?M(h,s*o.runSpeed,p>m?p:m):h*s>o.runSpeed?M(h,s*o.runSpeed,m):M(h,s*o.runSpeed,p);let _=t.vy,v=0;!f&&_>=0&&s!==0&&N(i,t.x,t.y,s,1)===0&&(v=s);let y=v===0?o.fallSpeed:o.slideSpeed;_=_<y?_+o.gravity>y?y:_+o.gravity:_-o.gravity<y?y:_-o.gravity;let x=t.air,D=t.wallAir,O=t.jumping,k=!1;if(l||t.buffer>0){if(f||t.air<=o.coyote)_=-o.jumpSpeed,k=!0,x=255;else{let e=N(i,t.x,t.y,-1,o.wallReach),n=N(i,t.x,t.y,1,o.wallReach),r=0;e>=0&&n>=0?r=s===0?e<=n?-1:1:s:e>=0?r=-1:n>=0?r=1:t.wallSide!==0&&t.wallAir<=o.wallCoyote&&(r=t.wallSide),r!==0&&(h=-r*o.wallJumpX,_=-o.wallJumpY,k=!0,v=0,D=255,u=o.wallLock,d=u>0?r:0)}}k&&(O=1);let A=k?0:l?o.jumpBuffer:t.buffer>0?t.buffer-1:0;O===1&&c===0&&_<-o.jumpCut&&(_=-o.jumpCut,O=0),_>=0&&(O=0),h=ee(h,-2048,E),_=ee(_,-2048,E);let j=t.x,P=t.y,F=C(i,j,w,h,P,T,!0);j=F.pos,F.blocked&&(h=0);let I=C(i,P,T,_,j,w,!1);if(I.blocked&&_<0&&o.cornerTolerance>0){let t=b(I.pos)-1,r=b(j),a=b(j+w-1),s=n(g(i,r,t)),c=n(g(i,a,t)),l=j;r!==a&&s&&!c&&(r+1)*4096-j<=o.cornerTolerance?l=(r+1)*e:r!==a&&c&&!s&&j+3072-a*4096<=o.cornerTolerance&&(l=a*e-w),l!==j&&!S(i,l,P,3072,3072)&&(j=l,I=C(i,P,T,_,j,w,!1))}P=I.pos,I.blocked&&(_<0&&(O=0),_=0);let L=_>=0&&S(i,j,P+1,3072,3072)?1:0;L?x=0:x<255&&(x+=1);let R=t.wallSide;if(L)R=0,D=255;else{let e=N(i,j,P,-1,1)===0,t=N(i,j,P,1,1)===0;e===t?e&&t?(R=s===0?R:s,D=0):D<255&&(D+=1):(R=e?-1:1,D=0)}return L&&(O=0),{x:j,y:P,vx:h+0,vy:_+0,ground:L,air:x,wallSide:R,wallAir:D,slide:v,buffer:A,held:c,jumping:O,lock:u,lockDir:d}}var F=[`aucune`,`pic`,`scie`,`chute`],I=1024,L=2048;function R(t,n,r){let i=e,a=n*i,o=r*i,s=i-2*I;switch(t){case 4:return{x:a+I,y:o+i-L,w:s,h:L};case 5:return{x:a+I,y:o,w:s,h:L};case 6:return{x:a+i-L,y:o+I,w:L,h:s};case 7:return{x:a,y:o+I,w:L,h:s};default:throw RangeError(`spikeBox : la tuile ${t} n'est pas un pic`)}}function te(e,t){return e.x<t.x+t.w&&t.x<e.x+e.w&&e.y<t.y+t.h&&t.y<e.y+e.h}var ne=(e,t,n)=>e<t?t:e>n?n:e;function re(e,t,n){let r=e-ne(e,n.x,n.x+n.w),i=t-ne(t,n.y,n.y+n.h);return r*r+i*i}function ie(e,t,n,r){return re(e,t,r)<n*n}function z(e){return{status:0,time:0,player:A(e),tiles:e.tiles,crumbles:e.crumbles.map(()=>0),sections:e.sections.map(()=>-1),deathCause:0,deathX:0,deathY:0,deathTicks:0,springCell:-1,springTime:0,checkpoint:-1}}function B(e,t){let n=e.checkpoints[t.checkpoint],r=t.sections.map((t,r)=>e.sections[r].c1>=n.col?-1:t);return{...z(e),status:1,time:t.time,player:A({...e,start:n}),sections:r,checkpoint:t.checkpoint}}function ae(e,t,n){let r=e.saws[n];if(r.section<0)return 0;let i=t.sections[r.section];return i<0?0:t.time-i}function oe(e,t){return e.saws.map((n,r)=>v(n,ae(e,t,r)))}function se(e){return{x:e.x,y:e.y,w,h:T}}function ce(e,t){let n=t.player;if(n.y+3072>e.height*4096)return 3;let i=se(n),a=b(n.x),o=b(n.x+w-1),s=b(n.y)<0?0:b(n.y),c=b(n.y+T-1);for(let t=s;t<=c;t++)for(let n=a;n<=o;n++){if(n<0||n>=e.width)continue;let a=e.tiles[t*e.width+n];if(r(a)&&te(i,R(a,n,t)))return 1}for(let n=0;n<e.saws.length;n++){let r=e.saws[n],a=v(r,ae(e,t,n));if(ie(a.x,a.y,r.radius,i))return 2}return 0}function le(t,n){let r=e;return te(se(n),{x:t.finish.col*r,y:t.finish.row*r,w:r,h:r})}function ue(e,t){return t===e.tiles?e:{width:e.width,height:e.height,tiles:t}}function de(e,t,n){return t<0||n<0||t>=e.width||n>=e.height?-1:n*e.width+t}function V(n,r,i,a){if(!Number.isInteger(r)||r<0||r>7)throw RangeError(`Commande invalide : ${r}`);let o=r&4?1:0;if(n.status===3)return n;if(n.status===2){let e=n.deathTicks+1,t=n.checkpoint>=0?n.time+1:n.time;if(e<18)return{...n,deathTicks:e,time:t};if(n.checkpoint>=0){let e=B(i,{...n,time:t});return o&&(e.player={...e.player,held:1}),e}let r=z(i);return o&&(r.player={...r.player,held:1}),r}if(n.status===0){let e=r&3;if(!(e===1||e===2||o===1&&n.player.held===0))return n.player.held===o?n:{...n,player:{...n.player,held:o}}}let s=e,c=n.tiles,l=n.crumbles;for(let e=0;e<l.length;e++){let t=l[e];if(!(t<=0)&&(l===n.crumbles&&(l=[...l]),l[e]=t>1?t-1:-1,t===1)){c===n.tiles&&(c=[...c]);let t=i.crumbles[e];c[t.row*i.width+t.col]=0}}let u=P(n.player,r,ue(i,c),a),d=u.ground===1,f=b(u.x),p=b(u.x+w-1),m=n.springCell,h=n.springTime;if(d&&a.springSpeed>0){let e=b(u.y+T),r=b(u.x+t(w,2)),o=-1;for(let t of[r,f,p]){let n=de(i,t,e);if(n>=0&&c[n]===3){o=n;break}}if(o>=0){let e=a.springSpeed<2048?a.springSpeed:E;u={...u,vy:-e,ground:0,air:255,jumping:0,buffer:0},m=o,h=n.time+1}}let g=(e,t)=>{let r=de(i,e,t);if(r<0)return;let o=i.crumbleIndex[r];o<0||l[o]!==0||(l===n.crumbles&&(l=[...l]),l[o]=a.crumbleDelay>1?a.crumbleDelay:1)};if(d){let e=b(u.y+T);for(let t=f;t<=p;t++)g(t,e)}else{let e=(r&2?1:0)-(r&1?1:0),t=b(u.y),n=b(u.y+T-1);if(e>0&&(u.x+3072)%s===0)for(let e=t;e<=n;e++)g(b(u.x+w),e);if(e<0&&u.x%s===0)for(let e=t;e<=n;e++)g(b(u.x)-1,e)}let _=n.time+1,v=n.sections,y=b(u.x+t(w,2));for(let e=0;e<v.length;e++){let t=i.sections[e];v[e]>=0||y<t.c0||y>t.c1||(v===n.sections&&(v=[...v]),v[e]=_)}let x={...n,status:1,time:_,player:u,tiles:c,crumbles:l,sections:v,springCell:m,springTime:h};if(le(i,u))return{...x,status:3};let S=ce(i,x);if(S!==0)return{...x,status:2,deathCause:S,deathX:u.x+t(w,2),deathY:u.y+t(T,2),deathTicks:0};let C=b(n.player.x+t(w,2));if(y>C){let e=x.checkpoint;for(let t=0;t<i.checkpoints.length;t++){let n=i.checkpoints[t].col;C<n&&n<=y&&(e=t)}if(e!==x.checkpoint)return{...x,checkpoint:e}}return x}var fe=h(`
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
`);Object.freeze({floorRow:26,start:3,steps:[[33,1],[38,2],[43,3],[48,4]],coyoteLedge:57,gaps:[[75,2],[81,3],[88,4],[96,5],[105,6]],lowGaps:[[115,4,23],[124,3,24]],corridor:[133,10],chimneys:[[149,3],[154,2]],chimneyTopRow:16,wall:[163,12],slab:[171,18],slabHoles:[175,180,181,186],finish:193});var pe=h(`
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
`),me=h(`
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
`),he=class{state;constructor(e){this.state=e>>>0}next(){this.state=this.state+1831565813>>>0;let e=this.state;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}int(e){return this.next()%e}chance(e){return this.int(100)<e}pick(e){return e[this.int(e.length)]}shuffle(e){let t=e.slice();for(let e=t.length-1;e>0;e--){let n=this.int(e+1);[t[e],t[n]]=[t[n],t[e]]}return t}};function ge(e,t){let n=Math.imul((e|0)^2654435769,2246822507);return n^=n>>>13,n=Math.imul(n^(t|0),3266489909),n^=n>>>16,n>>>0}var H=class extends Error{constructor(e){super(e),this.name=`CodecError`}},U=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`;function _e(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2];t+=U[r>>2],t+=U[(r&3)<<4|(i??0)>>4],i!==void 0&&(t+=U[(i&15)<<2|(a??0)>>6]),a!==void 0&&(t+=U[a&63])}return t}function ve(e){let t=[],n=0,r=0;for(let i=0;i<e.length;i++){let a=U.indexOf(e[i]);if(a<0)throw new H(`caractère invalide`);n=n<<6|a,r+=6,r>=8&&(r-=8,t.push(n>>r&255),n&=(1<<r)-1)}if(r>=6)throw new H(`longueur invalide`);return t}function W(e,t){for(;t>=128;)e.push(t&127|128),t>>=7;e.push(t)}function ye(e,t=21){let n=0,r=0;for(;;){let i=e();if(n+=(i&127)*(1<<r),!(i&128))return n;if(r+=7,r>t)throw new H(`entier trop long`)}}var G=72e3,be=/^[a-z0-9_:-]{1,40}$/,xe=256,Se=4096,Ce=1,K=2,q=4,J=class extends Error{code;constructor(e,t){super(t),this.code=e,this.name=`JumpReplayError`}},we=Object.freeze({checkpoint:-1,held:0,time:0,sections:Object.freeze([]),elan:0});function Y(e){let t=0;for(let n of e)t+=n.count;return t}function Te(e){let t=[];for(let n of e)for(let e=0;e<n.count;e++)t.push(n.bits);return t}function Ee(e){if(!be.test(e))throw new J(`format`,`Identifiant de niveau invalide : « ${e} »`)}function De(e){Ee(e.levelId);let t=e.start,n=[1];W(n,e.simVersion),n.push(e.levelId.length);for(let t=0;t<e.levelId.length;t++)n.push(e.levelId.charCodeAt(t));let r=t.checkpoint>=0;if(r&&t.elan)throw new J(`format`,`Départ lancé sur un point de passage`);if(n.push((t.held?Ce:0)|(r?K:0)|(t.elan?q:0)),r){W(n,t.checkpoint),W(n,t.time),W(n,t.sections.length);for(let e of t.sections)W(n,e+1)}let i=0;for(let t of e.runs){if(!Number.isInteger(t.count)||t.count<1)throw new J(`format`,`Série vide`);if(!Number.isInteger(t.bits)||t.bits<0||t.bits>7)throw new J(`format`,`Commande invalide : ${t.bits}`);if(i+=t.count,i>G)throw new J(`length`,`Rediffusion trop longue (plus de ${G} pas)`);W(n,t.count*8+t.bits)}return _e(n)}function Oe(e){if(typeof e!=`string`||e.length===0)throw new J(`format`,`Rediffusion vide`);let n;try{n=ve(e)}catch(e){throw e instanceof H?new J(`format`,`Rediffusion illisible (${e.message})`):e}let r=0,i=()=>{let e=n[r++];if(e===void 0)throw new J(`format`,`Rediffusion tronquée`);return e},a=e=>{try{return ye(i)}catch(t){throw t instanceof H?new J(`format`,`${e} : entier trop long`):t}},o=i();if(o!==1)throw new J(`format`,`Format de rediffusion inconnu (${o})`);let s=a(`Version`),c=i(),l=``;for(let e=0;e<c;e++)l+=String.fromCharCode(i());Ee(l);let u=i();if(u&-8)throw new J(`format`,`Drapeaux de départ inconnus`);if(u&K&&u&q)throw new J(`format`,`Départ lancé sur un point de passage`);let d={checkpoint:-1,held:u&Ce?1:0,time:0,sections:[],elan:u&q?1:0};if(u&K){let e=a(`Point de passage`),t=a(`Chrono`),n=a(`Sections`);if(e>=Se)throw new J(`format`,`Point de passage hors limites`);if(t>G)throw new J(`length`,`Chrono de départ trop long`);if(n>xe)throw new J(`format`,`Trop de sections`);let r=[];for(let e=0;e<n;e++){let e=a(`Section`)-1;if(e>t)throw new J(`format`,`Section mise en marche après le départ`);r.push(e)}d.checkpoint=e,d.time=t,d.sections=r}let f=[],p=0;for(;r<n.length;){let e=a(`Série`),n=e%8,r=t(e-n,8);if(r<1)throw new J(`format`,`Série vide`);if(p+=r,p>G)throw new J(`length`,`Rediffusion trop longue (plus de ${G} pas)`);f.push({count:r,bits:n})}return{simVersion:s,levelId:l,start:d,runs:f}}function X(e,t){if(t.checkpoint<0){let n=z(e);return!t.held&&!t.elan?n:{...n,player:{...n.player,held:+!!t.held,vx:t.elan?D.runSpeed:0}}}if(t.elan)throw new J(`format`,`Départ lancé sur un point de passage`);if(t.checkpoint>=e.checkpoints.length)throw new J(`level`,`Point de passage ${t.checkpoint} absent de ce niveau`);if(t.sections.length!==e.sections.length)throw new J(`level`,`Nombre de sections différent de celui du niveau`);let n=B(e,{...z(e),checkpoint:t.checkpoint,time:t.time,sections:t.sections});return t.held?{...n,player:{...n.player,held:1}}:n}function ke(e){return{checkpoint:e.checkpoint,held:e.player.held,time:e.time,sections:[...e.sections],elan:0}}function Ae(e,t,n){if(t.simVersion!==3)throw new J(`version`,`Rediffusion d'une autre version de la simulation (${t.simVersion}, actuelle 3)`);if(n!==void 0&&t.levelId!==n)throw new J(`level`,`Rediffusion d'un autre niveau (« ${t.levelId} »)`);if(Y(t.runs)>G)throw new J(`length`,`Rediffusion trop longue (plus de ${G} pas)`);return X(e,t.start)}function je(e,t){return t.status===3||t.status===2&&e.status!==2&&t.checkpoint<0}function Me(e,t,n){let r=Ae(e,t,n),i=[],a=[],o={start:{...t.start,sections:[...t.start.sections]},startTick:0,runs:[],ticks:0},s=0,c=!1;for(let n of t.runs)for(let t=0;t<n.count;t++){if(c)throw new J(`format`,`Pas après la fin de l'essai (pas ${s+1})`);let t=r;if(r=V(t,n.bits,e,D),s++,o){let e=o.runs[o.runs.length-1];e&&e.bits===n.bits?e.count++:o.runs.push({count:1,bits:n.bits}),o.ticks++}if(r.status===2&&t.status!==2){let e={cause:r.deathCause,x:r.deathX,y:r.deathY};i.push({tick:s,time:r.time,...e,life:a.length}),o&&a.push({index:a.length,...o,end:`mort`,death:e}),o=null}else r.status===1&&t.status===2?o={start:ke(r),startTick:s,runs:[],ticks:0}:r.status===3&&t.status!==3&&o&&(a.push({index:a.length,...o,end:`arrivée`,death:null}),o=null);je(t,r)&&(c=!0)}return o&&o.ticks>0&&a.push({index:a.length,...o,end:`abandon`,death:null}),{finished:r.status===3,ticks:s,time:r.time,deaths:i,lives:a,final:r}}function Ne(e,t){return{simVersion:e.simVersion,levelId:e.levelId,start:t.start,runs:t.runs.map(e=>({...e}))}}var Pe=class{level;replay;state;prev;tick=0;total;run=0;left;constructor(e,t){this.level=e,this.replay=t,this.state=Ae(e,t),this.prev=this.state,this.total=Y(t.runs),this.left=t.runs[0]?.count??0}get done(){return this.tick>=this.total}next(){let e=this.replay.runs[this.run];return e?(this.left--,this.left===0&&(this.run++,this.left=this.replay.runs[this.run]?.count??0),e.bits):0}step(){return this.done?(this.prev=this.state,!1):(this.prev=this.state,this.state=V(this.state,this.next(),this.level,D),this.tick++,!0)}},Fe=class{levelId;inputs=[];count=0;held=0;active=!1;skipping=!1;constructor(e){this.levelId=e,Ee(e)}get recording(){return this.active}get ticks(){return this.count}step(e,t,n){if(this.skipping){if(n.status!==0)return null;this.skipping=!1}if(!this.active){if(e.status!==0||n.status===0)return null;this.active=!0,this.inputs=[],this.count=0,this.held=e.player.held}if(this.count>=G)return this.active=!1,this.skipping=!0,this.inputs=[],this.count=0,null;let r=this.inputs[this.inputs.length-1];return r&&r.bits===t?r.count++:this.inputs.push({count:1,bits:t}),this.count++,n.status===3?this.close(`arrivée`):je(e,n)?this.close(`mort`):null}abandon(){return this.skipping=!1,!this.active||this.count===0?(this.active=!1,null):this.close(`abandon`)}peek(){return!this.active||this.count===0?null:this.replayOf()}replayOf(){return{simVersion:3,levelId:this.levelId,start:{...we,held:this.held},runs:this.inputs.map(e=>({...e}))}}close(e){let t=this.replayOf();return this.active=!1,this.inputs=[],this.count=0,{replay:t,end:e}}};function Z(e,t){return Math.imul(e^(t|0),16777619)>>>0}function Ie(e,t){let n=new Pe(e,t),r=2166136261,i=0;for(;n.step();){let e=n.state,t=e.player;for(let e of[t.x,t.y,t.vx,t.vy,t.ground,t.air,t.wallSide,t.wallAir,t.slide,t.buffer,t.held,t.jumping,t.lock,t.lockDir])r=Z(r,e);for(let t of[e.status,e.time,e.deathCause,e.deathX,e.deathY,e.deathTicks,e.springCell,e.springTime,e.checkpoint])r=Z(r,t);for(let t of e.crumbles)r=Z(r,t);for(let t of e.sections)r=Z(r,t);e.status===2&&n.prev.status!==2&&i++}return{hash:r.toString(16).padStart(8,`0`),finished:n.state.status===3,ticks:n.tick,time:n.state.time,deaths:i}}var Le=480,Q=e=>b(e.player.x+t(w,2));function Re(e,t){let n=Te(t.runs),r=[],i=e.checkpoints.map(()=>-1),a=X(e,t.start);for(let t=0;t<n.length;t++)a=V(a,n[t],e,D),a.checkpoint>=0&&i[a.checkpoint]===-1&&(i[a.checkpoint]=t+1,r[a.checkpoint]=a);return{inputs:n,resume:i.map((t,i)=>{if(t<0)return-1;let a=B(e,r[i]),o=t,s=-1;for(let r=t-120<0?0:t-120;r<=t+30&&r<n.length;r+=2){let t=a,i=Q(t);for(let a=0;a<360&&r+a<n.length&&(t=V(t,n[r+a],e,D),t.status===1);a++){let e=Q(t);e>i&&(i=e)}t.status===3&&(i+=1e4),i>s&&(s=i,o=r)}return o})}}function ze(e,n,r,i){let a=new he(r),o=Re(e,n),s=i.maxLives??6,c=X(e,n.start),l=[],u=(e,t)=>{let n=e+a.int(t);return[n,n+4+a.int(37),a.int(8)]};for(let r=0;r<i.attempts;r++){let r=[u(0,a.chance(50)?t(o.inputs.length,3):o.inputs.length)],i=new Fe(n.levelId),d=c,f=0,p=1,m=Q(d),h=0,g=null;for(;;){let t=o.inputs[f]??0;for(let[e,n,i]of r)f>=e&&f<n&&(t=i);let n=d;if(d=V(n,t,e,D),g=i.step(n,t,d),g)break;f++;let c=Q(d);if(c>m)m=c,h=0;else if(++h>Le){g=i.abandon();break}if(d.status===1&&n.status===2){if(++p>s){g=i.abandon();break}f=o.resume[d.checkpoint]??0,f<0&&(f=0),h=0,m=Q(d),a.chance(70)&&r.push(u(f,360))}}g&&l.push(g)}return l}var Be=`id: ascenseur
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
`.split(`(`),Ve={jumpSimVersion:3,exigenceVersion:1,modules:{ascenseur:{variants:[{grid:`1b80a03a`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowABQINKIHNqoL`,ticks:312,fastest:312,gigue:[1e3,980,895],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjowBLIHProL`,ticks:308,fastest:308,gigue:[1e3,1e3,935],raccord:1e3,exigence:1}},{grid:`d9cd36ad`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxABQIHKIH7gs`,ticks:311,fastest:312,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoxBLoH7gs`,ticks:308,fastest:308,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1808cb7f`,arret:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyAAwYHMIILvoK`,ticks:323,fastest:323,gigue:[1e3,1e3,990],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOmFzY2Vuc2V1cjoyBLIINpoL`,ticks:319,fastest:319,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}}]},"cheminee-pics":{variants:[{grid:`bd792ba8`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MACKBdYBSDTlARDOARpmTSA9pgg`,ticks:344,fastest:339,gigue:[895,520,325],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MATKBMYBMZUCEOYBCjxOVRElhggi`,ticks:332,fastest:332,gigue:[1e3,815,580],raccord:1e3,exigence:3}},{grid:`511e259d`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQCqBY4BUN0BKUU-WhWZAbYBGK0BCRSiCA`,ticks:372,fastest:372,gigue:[985,825,605],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXBpY3M6MQSqBmi8ARKWATAkQUwStgEahQESKaYICg`,ticks:367,fastest:362,gigue:[885,580,160],raccord:1e3,exigence:4}}]},"cheminee-scie":{variants:[{grid:`28242929`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MACCB0B9ErYBCDyNAUKGCDI`,ticks:326,fastest:320,gigue:[770,265,130],raccord:null,exigence:5},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MASyBjAJZS4SjgEqNLUBEqYIEg`,ticks:314,fastest:310,gigue:[525,260,120],raccord:958,exigence:5}},{grid:`73bb54e6`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQC6BYYBQP0BCJQBSuUBEUz6Bw`,ticks:336,fastest:336,gigue:[875,480,280],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MQTiBKYBMf0BGJYBIvUBGk7qBw`,ticks:325,fastest:326,gigue:[1e3,850,450],raccord:1e3,exigence:3}},{grid:`33e092fc`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgDKBWZA_QESngEi5QEINI4I`,ticks:329,fastest:327,gigue:[910,600,355],raccord:null,exigence:3},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MgSyBigJrQERrgESFOUBEKYIEg`,ticks:320,fastest:318,gigue:[935,515,305],raccord:1e3,exigence:4}},{grid:`bce7721f`,arret:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwA0EBSeBig03QEIxAEybI0BCgkILJYI`,ticks:346,fastest:346,gigue:[900,420,185],raccord:null,exigence:4},elan:{code:`AQMWbW9kdWxlOmNoZW1pbmVlLXNjaWU6MwTSBLYBOY0CIK4BSfUBCT1G0gc`,ticks:338,fastest:338,gigue:[1e3,800,525],raccord:1e3,exigence:3}}]},cheminee:{variants:[{grid:`ed68c430`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAAHBAcugdOClYKHkQlCl4KXiUJHUSGBxI`,ticks:317,fastest:317,gigue:[785,450,275],raccord:null,exigence:5},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjAEwgdWCk4KHkQlCl4KXiUJHUSWBw`,ticks:310,fastest:310,gigue:[625,600,380],raccord:667,exigence:4}},{grid:`e49c3866`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEADAgc2gfeAQoWLE08ErYBCh4seb4I`,ticks:362,fastest:363,gigue:[1e3,1e3,930],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjEEwgfmARokbSQirgEKFiSRAa4I`,ticks:355,fastest:355,gigue:[680,605,485],raccord:667,exigence:4}},{grid:`aec800d5`,arret:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIAqgggGYUBCq4BEqUBKo4BMjRlMq4I`,ticks:385,fastest:385,gigue:[875,580,315],raccord:null,exigence:4},elan:{code:`AQMRbW9kdWxlOmNoZW1pbmVlOjIE-gXGAVF1ET2GAQg8hQEKfkQKPoUBCr4I`,ticks:376,fastest:373,gigue:[960,795,565],raccord:1e3,exigence:3}}]},"demi-tour":{variants:[{grid:`81eac41f`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowAHKWBSreAjlAlQIRLe4I`,ticks:341,fastest:343,gigue:[1e3,970,870],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjowBKIE5gEKjgQypgG6CQ`,ticks:339,fastest:339,gigue:[1e3,935,885],raccord:1e3,exigence:2}},{grid:`bc4882dc`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxAMIBpgYSrgEizgIKjgoq`,ticks:359,fastest:359,gigue:[765,695,500],raccord:null,exigence:3},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoxBBpOogPGAiLGA0AcQiihAVruCQ`,ticks:376,fastest:382,gigue:[1e3,975,925],raccord:1e3,exigence:1}},{grid:`4c399709`,arret:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyAAwIJI4BwgNGigMwDE1EbQwWECxeHQ6yAp4Bggk`,ticks:399,fastest:401,gigue:[755,530,300],raccord:null,exigence:5},elan:{code:`AQMSbW9kdWxlOmRlbWktdG91cjoyBEoO4gLeAYoB9gUIbIYK`,ticks:366,fastest:367,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},descente:{variants:[{grid:`9d8594d2`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAAHAgcwgMm4gQm-gg`,ticks:290,fastest:290,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjAEogImsg8`,ticks:286,fastest:286,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`bcec8572`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEAHAgcogMm4gQmogUmkgc`,ticks:345,fastest:345,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjEEggMm4gomggc`,ticks:340,fastest:340,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`2570cb33`,arret:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIAHAgc-hs`,ticks:454,fastest:454,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOmRlc2NlbnRlOjIEggEm8ho`,ticks:450,fastest:450,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"escalier-friable":{variants:[{grid:`c46b8a55`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MACiAbYECo4B0gJm0gJmogI0NYYF`,ticks:344,fastest:340,gigue:[1e3,965,810],raccord:null,exigence:2},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MASSAbYEIkb6AWa6AlayAl7KBQ`,ticks:330,fastest:330,gigue:[840,460,225],raccord:1e3,exigence:4}},{grid:`bf32daf1`,arret:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQCCAqYEMqYBggNmogKOAaoD5gU`,ticks:384,fastest:384,gigue:[1e3,1e3,940],raccord:null,exigence:1},elan:{code:`AQMZbW9kdWxlOmVzY2FsaWVyLWZyaWFibGU6MQQ6vgQylgGCA5YBsgNmggPWBQo`,ticks:373,fastest:373,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]},escalier:{variants:[{grid:`8597f3cb`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAAygF-2gK-AzLGCjI`,ticks:318,fastest:312,gigue:[1e3,970,840],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjAEjgHKAmaiAtYM`,ticks:308,fastest:308,gigue:[865,700,430],raccord:1e3,exigence:3}},{grid:`d7e610ba`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEAHBAc9gMSZsoCdroCngs`,ticks:357,fastest:357,gigue:[1e3,1e3,885],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjEEjgG6ApYB0gJmogLGCxo`,ticks:351,fastest:351,gigue:[1e3,910,635],raccord:1e3,exigence:2}},{grid:`c1b51846`,arret:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIA2gFu4gJmkgK-AeoChg0`,ticks:406,fastest:400,gigue:[1e3,995,880],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOmVzY2FsaWVyOjIElgGCA5YB0gLGBDLWCyo`,ticks:395,fastest:395,gigue:[1e3,1e3,995],raccord:1e3,exigence:1}}]},"grande-scie":{variants:[{grid:`54c52887`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAA8gkO-gk`,ticks:318,fastest:312,gigue:[1e3,985,870],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjAEsgRGkgMOmgs`,ticks:308,fastest:308,gigue:[985,935,880],raccord:1e3,exigence:2}},{grid:`2973b43e`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEAJAgkqgUWigMOkgs`,ticks:324,fastest:323,gigue:[1e3,855,825],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjEE0gUOggMOmgs`,ticks:319,fastest:319,gigue:[1e3,890,795],raccord:1e3,exigence:2}},{grid:`20c5c984`,arret:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIAFBAsigkOmgs`,ticks:334,fastest:334,gigue:[835,615,450],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOmdyYW5kZS1zY2llOjIEogkmkgs`,ticks:330,fastest:330,gigue:[555,540,320],raccord:917,exigence:5}}]},"iles-friables":{variants:[{grid:`d0bf753f`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MAAcCCRe-gPuBDJu4gPuBRo`,ticks:334,fastest:334,gigue:[1e3,1e3,845],raccord:null,exigence:2},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MAR2ggSWBRJe0gOWAYoF`,ticks:330,fastest:330,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}},{grid:`ad804d6e`,arret:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQAMIGQe2gNGwgJ--gKuAfoCpgGKA166Aw`,ticks:392,fastest:389,gigue:[1e3,990,900],raccord:null,exigence:1},elan:{code:`AQMWbW9kdWxlOmlsZXMtZnJpYWJsZXM6MQS6Ac4EQo4B-gLWAfoCrgGKA06CBA`,ticks:384,fastest:384,gigue:[1e3,980,815],raccord:1e3,exigence:2}}]},lucarne:{variants:[{grid:`489ef2fc`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MAAkCBziBKYBggXmCgo`,ticks:357,fastest:357,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MASGAaIEhgHiAibCA4YJGg`,ticks:351,fastest:349,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}},{grid:`a0ef9966`,arret:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQAcCCTaBI4B4gImwgOmCSI`,ticks:356,fastest:356,gigue:[1e3,930,830],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOmx1Y2FybmU6MQTGAeIDhgHiAibCA4YJGg`,ticks:351,fastest:351,gigue:[1e3,1e3,950],raccord:1e3,exigence:1}}]},"mur-friable":{variants:[{grid:`dc84ce14`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAADAgckgamAQoeRCUKXgo-ISXGBwo`,ticks:288,fastest:288,gigue:[1e3,805,610],raccord:null,exigence:2},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjAEugTOAQq-AQh8CDwIfAk9hgdC`,ticks:288,fastest:285,gigue:[1e3,1e3,895],raccord:1e3,exigence:2}},{grid:`7bfb1b84`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEAggXeAQpeCoYBCHwKfgh8CDyGByo`,ticks:309,fastest:305,gigue:[1e3,720,590],raccord:null,exigence:3},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjEEsgYdTApWPQktPgh8CTU0CS00lgcK`,ticks:301,fastest:301,gigue:[900,910,655],raccord:1e3,exigence:2}},{grid:`f63513b4`,arret:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIADAgsggZWCjYiHkQlCl4KXiUJHUYKPi0JFcYHCg`,ticks:316,fastest:316,gigue:[885,560,380],raccord:null,exigence:4},elan:{code:`AQMUbW9kdWxlOm11ci1mcmlhYmxlOjIEwgTGAQq-AQg8Rgg8Rgh8Cj4KPkQKvgc6`,ticks:319,fastest:313,gigue:[1e3,1e3,985],raccord:1e3,exigence:1}}]},"mur-seul":{variants:[{grid:`909f5b11`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAADBA8tgQK1gFKlgg`,ticks:246,fastest:246,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjAEImaiA6YCIaYICg`,ticks:241,fastest:241,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`ffc6b621`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEAJAgcxgQKngIKngMKnggK`,ticks:301,fastest:301,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjEEWl7CA9YBCr4BggKGCDI`,ticks:294,fastest:294,gigue:[1e3,1e3,955],raccord:1e3,exigence:1}},{grid:`81a9d331`,arret:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIAigI-sgPWAQr-AgrOAeoBxgH6Bg`,ticks:358,fastest:358,gigue:[1e3,1e3,985],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOm11ci1zZXVsOjIEfroDtgIKngGSAp4BmgL2BzI`,ticks:348,fastest:348,gigue:[1e3,1e3,980],raccord:1e3,exigence:1}}]},"petits-trous":{variants:[{grid:`aa08c30c`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowAAwIHKoDLtoENrIF5gc`,ticks:354,fastest:356,gigue:[1e3,1e3,975],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czowBLICRtoFHroF5gc`,ticks:351,fastest:351,gigue:[1e3,1e3,875],raccord:1e3,exigence:2}},{grid:`3db1b5e5`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxAAwIFLIDNsIFTqoG5gc`,ticks:386,fastest:389,gigue:[1e3,980,915],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoxBIoDTuoFPpoGTrIH`,ticks:384,fastest:384,gigue:[1e3,1e3,915],raccord:1e3,exigence:1}},{grid:`26172342`,arret:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyAAwIJNoDTsIGPooHTooH`,ticks:420,fastest:421,gigue:[1e3,1e3,925],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBldGl0cy10cm91czoyBNoDXooGVooHPsIH`,ticks:417,fastest:417,gigue:[1e3,970,870],raccord:1e3,exigence:2}}]},piliers:{variants:[{grid:`3db582ea`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MAAUCBzaBKYBmgMWogP-Bw`,ticks:333,fastest:334,gigue:[1e3,1e3,945],raccord:null,exigence:1},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MATiBO4B-gIW2gN-sgY`,ticks:330,fastest:330,gigue:[1e3,1e3,935],raccord:1e3,exigence:1}},{grid:`6d365105`,arret:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQCaBR6KA1baAibKAzaaAs4G`,ticks:395,fastest:389,gigue:[1e3,930,670],raccord:null,exigence:2},elan:{code:`AQMQbW9kdWxlOnBpbGllcnM6MQTyBA6iAz6iAg6aA2baAh6iBg`,ticks:384,fastest:384,gigue:[1e3,900,705],raccord:1e3,exigence:2}}]},"plafond-pics":{variants:[{grid:`011c5c74`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowAAwYHIoHLpoDHtIDRqoI`,ticks:378,fastest:378,gigue:[1e3,920,845],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczowBKIHLroDJooDPsoI`,ticks:373,fastest:373,gigue:[1e3,1e3,920],raccord:1e3,exigence:1}},{grid:`51abd8d9`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxABwIJJIHLtIENrIDRvII`,ticks:411,fastest:411,gigue:[1e3,860,625],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoxBKIHNrIENvoDPtII`,ticks:406,fastest:406,gigue:[1e3,1e3,870],raccord:1e3,exigence:2}},{grid:`712f7279`,arret:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyAAwIJJoHPvoERpIFPsoI`,ticks:441,fastest:443,gigue:[1e3,950,625],raccord:null,exigence:2},elan:{code:`AQMVbW9kdWxlOnBsYWZvbmQtcGljczoyBLoHPooFPvIERtoI`,ticks:439,fastest:439,gigue:[1e3,970,550],raccord:1e3,exigence:3}}]},plaine:{variants:[{grid:`3a1c57a5`,arret:{code:`AQMPbW9kdWxlOnBsYWluZTowABwIHPoKNroI`,ticks:323,fastest:323,gigue:[1e3,1e3,930],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZTowBPoKhgk`,ticks:319,fastest:319,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`1da5fbe0`,arret:{code:`AQMPbW9kdWxlOnBsYWluZToxABwIHPIOPsoI`,ticks:389,fastest:389,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZToxBJIPNsII`,ticks:384,fastest:384,gigue:[1e3,1e3,925],raccord:1e3,exigence:1}},{grid:`25687fab`,arret:{code:`AQMPbW9kdWxlOnBsYWluZToyABwIHPoShgk`,ticks:454,fastest:454,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnBsYWluZToyBJoTNsoI`,ticks:450,fastest:450,gigue:[1e3,1e3,960],raccord:1e3,exigence:1}}]},"pont-friable":{variants:[{grid:`0b9ae282`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowABwIHIoT`,ticks:312,fastest:312,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZTowBKIT`,ticks:308,fastest:308,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`b72b81df`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxABwIHOoV`,ticks:356,fastest:356,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToxBPoV`,ticks:351,fastest:351,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`c7819723`,arret:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyABwIHMoY`,ticks:400,fastest:400,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMVbW9kdWxlOnBvbnQtZnJpYWJsZToyBNoY`,ticks:395,fastest:395,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},puits:{variants:[{grid:`bddcde31`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjAAogI28gFgMaAC6gk`,ticks:283,fastest:280,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjAEggHGA0DBAUDaCQ`,ticks:267,fastest:267,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cc63828a`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjEAogI28gFgMaACkgEwogk`,ticks:298,fastest:298,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjEEggGGBECBAcAB4gk`,ticks:284,fastest:284,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`27ab3245`,arret:{code:`AQMObW9kdWxlOnB1aXRzOjIAogI2kgTBAbIL`,ticks:314,fastest:313,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMObW9kdWxlOnB1aXRzOjIEal6CA-ADYZIK`,ticks:306,fastest:301,gigue:[1e3,1e3,965],raccord:1e3,exigence:1}}]},quinconce:{variants:[{grid:`789174e8`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowACQIFNIFXuoEXuIDTpIJ`,ticks:411,fastest:411,gigue:[1e3,1e3,950],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZTowBPIFXuIEXsoDTqIJ`,ticks:406,fastest:406,gigue:[1e3,1e3,915],raccord:1e3,exigence:1}},{grid:`2f8e34ae`,arret:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxABwIJMoFlgHqBX7yBKYK`,ticks:465,fastest:465,gigue:[1e3,985,870],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnF1aW5jb25jZToxBPIFfvIFhgHiBLYK`,ticks:461,fastest:461,gigue:[1e3,1e3,940],raccord:1e3,exigence:1}}]},"ressort-mur":{variants:[{grid:`dc7e8fa5`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAAJAgc5g4i`,ticks:248,fastest:248,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjAESh7yAhayCw`,ticks:242,fastest:242,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cedfc129`,arret:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEAJAgcxg8a`,ticks:259,fastest:259,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMUbW9kdWxlOnJlc3NvcnQtbXVyOjEESh7yAhaKDA`,ticks:253,fastest:253,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"ressort-plafond":{variants:[{grid:`0a88fc81`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowADQILKYRMg`,ticks:294,fastest:294,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDowBNYRIg`,ticks:286,fastest:286,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`2fdab1c7`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxAJIC9gcKfgo-2gc`,ticks:307,fastest:343,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoxBNYFMrYDCCyWAQouygk`,ticks:333,fastest:331,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`94a1d0cd`,arret:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyABwgZuIDZqIDpgFihgwi`,ticks:371,fastest:371,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMYbW9kdWxlOnJlc3NvcnQtcGxhZm9uZDoyBP4FEo4ECq4MCg`,ticks:361,fastest:361,gigue:[1e3,935,780],raccord:1e3,exigence:2}}]},"ressorts-trous":{variants:[{grid:`1f599899`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAAHAg0ogUO8hk`,ticks:509,fastest:509,gigue:[1e3,1e3,960],raccord:null,exigence:1},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjAEogUmgho`,ticks:504,fastest:504,gigue:[1e3,1e3,910],raccord:1e3,exigence:1}},{grid:`71989c1e`,arret:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEAJAgM-gUOwhs`,ticks:542,fastest:542,gigue:[615,370,285],raccord:null,exigence:5},elan:{code:`AQMXbW9kdWxlOnJlc3NvcnRzLXRyb3VzOjEE6gUW0hs`,ticks:537,fastest:537,gigue:[690,420,470],raccord:1e3,exigence:5}}]},"saut-long":{variants:[{grid:`afdab2f3`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowABwIHKIIzg0`,ticks:356,fastest:356,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzowBPoHhg4`,ticks:351,fastest:351,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`07d22558`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxABwIJKoIXroN`,ticks:367,fastest:367,gigue:[1e3,1e3,955],raccord:null,exigence:1},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoxBLoIng4`,ticks:362,fastest:362,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`cf074791`,arret:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyABQQJKoIfvIN`,ticks:378,fastest:378,gigue:[1e3,985,895],raccord:null,exigence:2},elan:{code:`AQMSbW9kdWxlOnNhdXQtbG9uZzoyBLoI9g4`,ticks:373,fastest:373,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-ronde":{variants:[{grid:`b86e0514`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MADSCb4LGg`,ticks:340,fastest:334,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MASCCcYLEg`,ticks:330,fastest:330,gigue:[1e3,1e3,860],raccord:1e3,exigence:2}},{grid:`d54df661`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQA0CDSSBTZgMmFaMfoBNvIJ`,ticks:343,fastest:342,gigue:[720,720,635],raccord:null,exigence:2},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MQTCB0DCAiaiCg`,ticks:336,fastest:335,gigue:[710,665,535],raccord:1e3,exigence:3}},{grid:`5efb6cdc`,arret:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgAcCBy6FA`,ticks:334,fastest:334,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMTbW9kdWxlOnNjaWUtcm9uZGU6MgSCCiaiCg`,ticks:328,fastest:328,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},"scie-sol":{variants:[{grid:`fb55c197`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAAFAgU8gW2BCL-CQo`,ticks:333,fastest:334,gigue:[1e3,980,845],raccord:null,exigence:2},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjAE-gW2BBqGChI`,ticks:330,fastest:330,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`76b29e13`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEADBgsggXmAzLmAzKOBw`,ticks:334,fastest:334,gigue:[1e3,1e3,970],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjEEkgXmAyL-Axq2Bw`,ticks:330,fastest:330,gigue:[1e3,1e3,905],raccord:1e3,exigence:1}},{grid:`a4e8d18b`,arret:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIADAgcsgTuAhqmAyLGCQo`,ticks:332,fastest:334,gigue:[1e3,1e3,945],raccord:null,exigence:1},elan:{code:`AQMRbW9kdWxlOnNjaWUtc29sOjIEugT2AmLWAiLWCQo`,ticks:330,fastest:330,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]},tunnel:{variants:[{grid:`d56cf356`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDowABwIHIINZoIBZpIE`,ticks:321,fastest:321,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDowBOIOJuoE`,ticks:317,fastest:317,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`659d1761`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoxABwIHOISJuoE`,ticks:388,fastest:388,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoxBKIRZoIBZpIE`,ticks:382,fastest:382,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}},{grid:`16d8abd0`,arret:{code:`AQMPbW9kdWxlOnR1bm5lbDoyABwIHOIWJuoE`,ticks:452,fastest:452,gigue:[1e3,1e3,1e3],raccord:null,exigence:1},elan:{code:`AQMPbW9kdWxlOnR1bm5lbDoyBIIXJuoE`,ticks:449,fastest:449,gigue:[1e3,1e3,1e3],raccord:1e3,exigence:1}}]}}},He=[`mural`,`precision`,`vertical`,`scie`,`friable`,`ressort`,`respiration`],Ue=[`arret`,`elan`],$=class extends Error{constructor(e){super(e),this.name=`ModuleError`}},We=new Set([`id`,`intention`,`etiquettes`,`paliers`,`repeter`,`variante`]),Ge=/^[#.^v<>oOx*]+$/;function Ke(e){let t=e.replace(/\r/g,``).split(`
`),n=0,r={};for(;n<t.length;n++){let e=t[n].trim();if(e===``||e.startsWith(`//`))continue;if(e===`grille:`)break;let i=/^([a-z]+):\s*(.*)$/.exec(e);if(!i||!We.has(i[1]))throw new $(`Ligne ${n+1} : « clé: valeur » attendu (${[...We].join(`, `)}, puis « grille: »)`);(r[i[1]]??=[]).push(i[2].trim())}if(n>=t.length)throw new $(`« grille: » manquant`);let i=e=>{let t=r[e];if(!t||t.length!==1||t[0]===``)throw new $(`« ${e}: » attendu une fois`);return t[0]},o=i(`id`);if(!/^[a-z0-9-]{1,24}$/.test(o))throw new $(`id « ${o} » invalide (minuscules, chiffres, tirets, 24 au plus)`);let s=e=>`Morceau « ${o} » : ${e}`,c=i(`intention`),l=i(`etiquettes`).split(/\s+/);for(let e of l)if(!He.includes(e))throw new $(s(`étiquette « ${e} » inconnue (${He.join(`, `)})`));if(new Set(l).size!==l.length)throw new $(s(`étiquette en double`));let u=/^(\d+)\s+(\d+)$/.exec(i(`paliers`));if(!u)throw new $(s(`« paliers: <rangée d'entrée> <rangée de sortie> » attendu`));n++;let d=[];for(;n<t.length&&t[n].trim()!==``;n++)d.push(t[n].trim());let f=t.slice(n).map(e=>e.trim()).filter(e=>e!==``&&!e.startsWith(`//`));if(d.length===0)throw new $(s(`grille vide`));let p=d[0].length;d.forEach((e,t)=>{if(e.length!==p)throw new $(s(`rangée ${t} : ${e.length} colonnes au lieu de ${p}`));if(!Ge.test(e))throw new $(s(`rangée ${t} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`))});let m=Number(u[1]),h=Number(u[2]);if(m>=d.length||h>=d.length)throw new $(s(`rangée de palier hors de la grille`));let g=[],_=(r.repeter??[]).map(e=>{let t=/^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(e);if(!t)throw new $(s(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${e} »)`));let n={param:t[1],axis:t[2],from:Number(t[3]),to:Number(t[4])},r=n.axis===`colonnes`?p:d.length;if(n.from>n.to||n.to>=r)throw new $(s(`plage ${n.from}-${n.to} hors du gabarit`));return g.includes(n.param)||g.push(n.param),n});for(let e of _)for(let t of _)if(e!==t&&e.axis===t.axis&&e.from<=t.to&&t.from<=e.to)throw new $(s(`les plages ${e.from}-${e.to} et ${t.from}-${t.to} se chevauchent`));for(let e of f)for(let t of e.matchAll(/\{([a-z][a-z0-9]*)\}/g))g.includes(t[1])||g.push(t[1]);for(let e of[m,h])if(_.some(t=>t.axis===`rangees`&&e>=t.from&&e<=t.to))throw new $(s(`une rangée de palier ne se répète pas`));let v=(r.variante??[]).map((e,t)=>{let n={};for(let r of e.split(/\s+/).filter(Boolean)){let e=/^([a-z][a-z0-9]*)=(\d+)$/.exec(r);if(!e)throw new $(s(`variante ${t} : « nom=valeur » attendu (« ${r} »)`));if(!g.includes(e[1]))throw new $(s(`variante ${t} : paramètre « ${e[1]} » inconnu`));let i=Number(e[2]),o=_.some(t=>t.param===e[1])?40:a;if(i>o)throw new $(s(`variante ${t} : ${e[1]} = ${i} (au plus ${o})`));n[e[1]]=i}for(let e of g)if(n[e]===void 0)throw new $(s(`variante ${t} : « ${e} » manque`));return n});if(v.length===0)throw new $(s(`au moins une « variante: » (même sans paramètre)`));return{id:o,intention:c,tags:l,entryRow:m,exitRow:h,repeats:_,params:g,variants:v,grid:d,annex:f,text:e}}function qe(e,t,n){let r=[],i=Array(e).fill(-1),a=Array(e).fill(-1);for(let o=0;o<e;){let e=t.find(e=>e.from===o),s=e?e.to:o,c=e?n[e.param]:1;for(let e=0;e<c;e++)for(let t=o;t<=s;t++)e===0&&(i[t]=r.length),a[t]=r.length,r.push(t);o=s+1}return{src:r,first:i,last:a}}function Je(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619)>>>0;return t.toString(16).padStart(8,`0`)}function Ye(e,t,n={}){let r=e.variants[t];if(!r)throw new $(`Morceau « ${e.id} » : pas de variante ${t} (0 à ${e.variants.length-1})`);let i=n.lancement??0;if(!Number.isInteger(i)||i<0||i>40)throw new $(`lancement : de 0 à 40 colonnes`);let a=n=>`Morceau « ${e.id} », variante ${t} : ${n}`,o=qe(e.grid[0].length,e.repeats.filter(e=>e.axis===`colonnes`),r),s=qe(e.grid.length,e.repeats.filter(e=>e.axis===`rangees`),r),c=o.src.length,u=s.src.length;if(u>30)throw new $(a(`${u} rangées (au plus 30)`));if(c<6)throw new $(a(`trop étroit`));let d=s.first[e.entryRow],f=s.first[e.exitRow],p=1+i,m=s.src.map(t=>o.src.map(n=>e.grid[t][n]).join(``)),g=m.map((e,t)=>{let n=e[0].repeat(p),r=e[c-1];return(t===d-1?`S`+n.slice(1):n)+e+(t===f-1?`F`:r)});if(m[d-1]?.[0]!==`.`||m[f-1]?.[c-1]!==`.`)throw new $(a(`le départ et l'arrivée se posent sur des tuiles vides`));let _=[`section ${e.id} ${p}-${p+c-1}`];for(let t of e.annex){let e=t.replace(/\{([a-z][a-z0-9]*)\}/g,(e,t)=>String(r[t])).split(/\s+/);if(e[0]!==`scie`)throw new $(a(`bloc annexe : seules les scies sont permises (« ${e[0]} »)`));_.push(e.map((e,t)=>{let n=t>=5?/^(\d+)('?),(\d+)('?)$/.exec(e):null;if(!n)return e;let r=Number(n[1]),i=Number(n[3]),c=(n[2]?o.last:o.first)[r],l=(n[4]?s.last:s.first)[i];if(c===void 0||l===void 0||c<0||l<0)throw new $(a(`point ${e} hors du gabarit ou retiré par la variante`));return`${c+p},${l}`}).join(` `))}let v=g.join(`
`)+`

`+_.join(`
`)+`
`,y;try{y=h(v)}catch(e){throw e instanceof l?new $(a(e.message)):e}let b={id:e.id,variant:t,values:r,levelId:`module:${e.id}:${t}`,level:y,ascii:v,hash:Je(v),lead:p,width:c,height:u,entryRow:d,exitRow:f},x=Xe(b);if(x.length>0)throw new $(a(x.join(` ; `)));return b}function Xe(t){let n=[],r=t.level,i=e,a=[{name:`entrée`,c0:t.lead,row:t.entryRow},{name:`sortie`,c0:t.lead+t.width-3,row:t.exitRow}];for(let e of a){e.row-4<0&&n.push(`palier d'${e.name} : moins de 4 rangées au-dessus`);for(let i=e.c0;i<e.c0+3;i++){r.tiles[e.row*r.width+i]!==1&&n.push(`palier d'${e.name} : colonne ${i-t.lead} sans sol plein`);for(let a=Math.max(0,e.row-4);a<e.row;a++)r.tiles[a*r.width+i]!==0&&n.push(`palier d'${e.name} : tuile (${i-t.lead}, ${a}) occupée`)}let a={x:e.c0*i,y:(e.row-4)*i,w:3*i,h:4*i};for(let t of r.saws){let r=t.cycle===0?1:t.cycle;for(let i=0;i<r;i++){let r=v(t,i);if(ie(r.x,r.y,t.radius,a)){n.push(`palier d'${e.name} : la scie ${t.id} y passe`);break}}}}return n}var Ze=Be.map(Ke);function Qe(e){let t=Ze.find(t=>t.id===e);if(!t)throw new $(`Morceau « ${e} » inconnu`);return t}function $e(e,t,n={}){return Ye(Qe(e),t,n)}function et(e,t){return Ve.jumpSimVersion===3?Ve.modules[e]?.variants[t]??null:null}function tt(e){return!e||!e.arret||!e.elan||e.arret.exigence===0||e.elan.exigence===0?0:Math.max(e.arret.exigence,e.elan.exigence)}export{E as A,F as C,V as D,R as E,b as F,_ as I,r as L,w as M,k as N,D as O,j as P,e as R,fe as S,oe as T,Y as _,tt as a,me as b,J as c,De as d,Te as f,X as g,Ie as h,et as i,T as j,O as k,Pe as l,Me as m,Ue as n,ze as o,Ne as p,$e as r,Fe as s,Ze as t,Oe as u,he as v,z as w,pe as x,ge as y};