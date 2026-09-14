const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function machineWith(tagged, full = false){let handler;const item={hasTag:t=>tagged&&t==='utilitycraft:energy_container'};let repaired=0, writes=0;
 const m={valid:true,container:{getItem:()=>item,setItem(){writes++;}},energy:{amount:1000,get(){return this.amount;},consume(n){this.amount-=n;}},rate:100,boosts:{consumption:1},entity:{},showWarning(s){this.status=s;},showStatus(s){this.status=s;},on(){}};
 vm.runInNewContext(read('BP/scripts/machinery/machines/inductionAnvil.js').replace(/^import[^\n]*\r?\n/gm,''),{Machine:function(){return m;},registerIOInterface(){},DoriosLib:{registry:{blockComponent(id,h){handler=h;}},item:{durability:{getInfo(){assert.equal(tagged,false);return {remaining:full?100:50,max:100};},repair(s,n){repaired+=n;return n;}}}}});
 return {m,get writes(){return writes;},tick(){handler.onTick({block:{}},{params:{}});},get repaired(){return repaired;}};
}
test('normal anvil refuses energy-container durability repairs without spending energy',()=>{const h=machineWith(true);h.tick();assert.equal(h.m.energy.amount,1000);assert.equal(h.repaired,0);assert.equal(h.m.status,'Use Reinforced Induction Anvil');});
test('normal anvil keeps its existing behavior for ordinary items',()=>{const h=machineWith(false);h.tick();assert.equal(h.m.energy.amount,900);assert.equal(h.repaired,10);});

test('fully repaired normal anvil input is not rewritten or charged on repeated ticks',()=>{
 const h=machineWith(false,true);for(let i=0;i<5;i++)h.tick();
 assert.equal(h.writes,0);assert.equal(h.repaired,0);assert.equal(h.m.energy.amount,1000);assert.equal(h.m.status,'Fully Repaired');
});
