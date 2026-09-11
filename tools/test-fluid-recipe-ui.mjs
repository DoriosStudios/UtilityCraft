import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function walk(o,fn){for(const[k,v]of Object.entries(o)){fn(k,v);if(v&&typeof v==='object')walk(v,fn);}}
const uiDefs=read('RP/ui/_ui_defs.json').ui_defs;
const core=read('RP/ui/ui_core.json');
const inheritedTextures=new Set();walk(read('RP/ui/recipes/crusher.json'),(k,v)=>{if(typeof v==='string'&&v.startsWith('textures/'))inheritedTextures.add(v);});
const shared=read('RP/ui/recipes/fluid_core.json');
const pair=shared.fluid_pair_recipe_toggle;
assert.equal(pair.type,'panel');
assert.deepEqual(pair.size,[42,18]);
assert.equal(shared['fluid_recipe_ingredient@uc.recipe_toggle'].$toggle_layer,7);
assert.equal(core.liquid_bar.controls.find(c=>c.liquid_border).liquid_border.layer,9);
const button=pair.controls.find(c=>c['button@uc.recipe_toggle'])['button@uc.recipe_toggle'];
assert.deepEqual(button.$toggle_size,[42,18]);
assert.equal(button.$has_toggle_icon,false);
assert.equal(button.$toggle_unchecked_hover,'textures/ui/recipe_pair_hover');
assert.equal(button.$toggle_checked_hover,button.$toggle_unchecked_hover);
const hoverMetadata=read('RP/'+button.$toggle_checked_hover+'.json');
const hoverPng=fs.readFileSync('RP/'+button.$toggle_checked_hover+'.png');
assert.deepEqual(hoverMetadata.base_size,[hoverPng.readUInt32BE(16),hoverPng.readUInt32BE(20)]);
assert.equal(hoverMetadata.nineslice_size,1,'hover must scale to the rectangular button while preserving its border');
assert.equal(button.$toggle_default_state,'$pair_default_state');
assert.equal(button.controls,undefined,'inherit the standard selector states and interaction');
assert.equal(pair.controls.find(c=>c.first_icon).first_icon.texture,'$recipe_icon');
assert.equal(pair.controls.find(c=>c.second_icon).second_icon.texture,'$recipe_icon_2');
assert.equal(pair.controls.find(c=>c.plus).plus.text,'+');
for(const sprite of ['water','hydrogen_gas','oxygen_gas','methane_gas']){
 const png=fs.readFileSync('RP/textures/static/images/'+sprite+'.png');assert.equal(png.readUInt32BE(16),16);assert.equal(png.readUInt32BE(20),16);
}
for(const machine of ['electrolyzer','chemical_converter']){
 const source=fs.readFileSync('BP/scripts/config/recipes/'+machine+'.js','utf8');
 const defaults=JSON.parse(source.match(/const defaultRecipes = (\{[\s\S]*?\n\});/)[1]);
 const book=read('RP/ui/recipes/'+machine+'.json');
 const overlays=book[machine+'_recipes_panel'];
 assert.equal(overlays.bindings[0].source_control_name,'recipes_toggle_button');
 assert.equal(overlays.controls.length,Object.keys(defaults).length);
 assert.equal(uiDefs.filter(p=>p==='ui/recipes/'+machine+'.json').length,1);
 const live=read('RP/ui/'+machine+'.json');
 const top=live[machine+'_top'];
 const liveRef=machine+'_top@'+machine+'.'+machine+'_top';
 const instances=[];
 walk(live.utilitycraft_panel,(k,v)=>{if(k===liveRef)instances.push(v);assert(!k.includes('recipe_preview@'),'must not replace the live UI');});
 assert.equal(instances.length,2,'normal and recipe views must share the same live top');
 for(const override of instances)for(const k of Object.keys(override))assert(k==='$right_machine_tabs_name'||k==='$io_config_tabs_name'||k==='$energy_bar_offset'||k==='$energy_bar_bg_texture'||k.endsWith('_control_name'),'no visual/slot overrides: '+k);
 assert.equal(top.controls.filter(c=>c['recipe_overlays@uc.'+machine+'_recipes_panel']).length,1);
 for(const key of ['machine_name@uc.machine_name','machine_screen@uc.machine_small_screen','item_label@uc.text_label','progress@uc.progress_display','energy@uc.energy_bar','upgrades_tab@uc.upgrades_tab','io_tab@uc.io_tab','info_tab@uc.info_tab'])assert(top.controls.some(c=>c[key]),'preserve '+key);
 assert.equal(top.controls.find(c=>c['energy@uc.energy_bar'])['energy@uc.energy_bar'].offset,'$energy_bar_offset');
 assert.deepEqual(top['$energy_bar_offset|default'],[-101,-13]);
 const expanded=instances.find(v=>v.$energy_bar_offset);assert.deepEqual(expanded.$energy_bar_offset,[97,64]);assert.equal(expanded.$energy_bar_bg_texture,'textures/ui/toggle_button/right_bg');
 assert.deepEqual(book[machine+'_recipes_buttons'].offset,[0,-1]);
 const locales=['en_US','es_MX','pt_BR'].map(l=>Object.fromEntries(fs.readFileSync('RP/texts/'+l+'.lang','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)])));
 for(const doc of [book,shared])walk(doc,(k,v)=>{
  assert.notEqual(k,'modifications','new recipe controls cannot use modifications');
  if(typeof v==='string'&&v.startsWith('textures/'))assert(fs.existsSync('RP/'+v+'.png')||inheritedTextures.has(v)||['textures/ui/recipe_book_item_bg'].includes(v),v);
  if(typeof v==='string'&&v.startsWith('ui.utilitycraft:recipe.'))for(const lang of locales)assert(lang[v],v);
 });
 for(let i=0;i<overlays.controls.length;i++){
  const recipe=Object.values(defaults)[i],overlay=Object.values(overlays.controls[i])[0];
  const fluids=overlay.controls.filter(c=>Object.keys(c)[0].endsWith('@uc.fluid_recipe_ingredient'));
  const quantities=overlay.controls.filter(c=>Object.keys(c)[0].startsWith('quantity_')).map(c=>Object.values(c)[0]);
  const expected=machine==='electrolyzer'?[recipe.required_liquid,recipe.output1.amount,recipe.output2.amount]:[recipe.required_gas,recipe.output_gas.amount];
  assert.equal(quantities.length,0,'fluid quantities belong only in tooltips');
  assert.equal(fluids.length,expected.length);
  fluids.forEach((c,n)=>{const icon=Object.values(c)[0];assert.equal(icon.offset[1]+16,65);for(const lang of locales)assert(lang[icon.$toggle_hover_text].endsWith(': '+expected[n]+' mB'),'keep quantity in each localized hover');});
  assert(!overlay.controls.some(c=>c.summary||c.arrow||Object.keys(c)[0].startsWith('details_')),'overlays must not replace live labels or arrow');
  const toggle=Object.values(book[machine+'_recipes_buttons'].controls[i]['row_'+i].controls[0])[0];
  if(machine==='electrolyzer'){
   const row=book[machine+'_recipes_buttons'].controls[i]['row_'+i];
   const standardSize=read('RP/ui/recipes/core.json')['recipe_toggle@uc.toggle_button'].$toggle_size;
   assert.equal(toggle.anchor_from,'center');assert.equal(toggle.anchor_to,'left_middle');
   const standardLeft=(row.size[0]-standardSize[0])/2;
   const pairLeft=row.size[0]/2+toggle.offset[0];
   assert.equal(pairLeft,standardLeft,'pair must start at the visible standard selector edge, not the clipped row origin');
   assert.equal(row.size[1]/2+toggle.offset[1]-pair.size[1]/2,(row.size[1]-standardSize[1])/2);
   assert(pairLeft+pair.size[0]<=row.size[0],'both output icons must fit inside the recipe row');
   assert.equal(toggle.$pair_default_state,i===0,'first recipe must select the native child toggle');
  }
  const summary=locales[0][toggle.$toggle_hover_text];
  assert.equal(summary,machine==='electrolyzer'?'Hydrogen\\nOxygen':'Methane');
  if(machine==='chemical_converter'){
   const item=overlay.controls.find(c=>c['item_0@uc.recipe_slot_overlay'])['item_0@uc.recipe_slot_overlay'];
   assert.equal(item.collection_index,3);assert.equal(item.$has_slot_hover,false);assert.equal(item.$has_slot_count,recipe.required_items>1);
   if(recipe.required_items===1)assert.equal(item.$slot_count_text,undefined);
   assert.deepEqual(item.$slot_red_size,[16,16]);
   assert.deepEqual(item.$slot_offset,[-8,5]);
  }
 }
}
console.log('PASS: full live UI in both views, standard paired selector, output-only tooltips, Crusher item overlays and bottom-aligned fluid icons with quantities only in tooltips.');
