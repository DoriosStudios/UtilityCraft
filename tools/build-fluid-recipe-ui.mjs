import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const crusher=read('RP/ui/machines/crusher.json');
const book=read('RP/ui/recipes/crusher.json');
const resources={
 water:{texture:'textures/static/images/water',names:['Water','Agua','\u00c1gua']},
 hydrogen_gas:{texture:'textures/static/images/hydrogen_gas',names:['Hydrogen','Hidr\u00f3geno','Hidrog\u00eanio']},
 oxygen_gas:{texture:'textures/static/images/oxygen_gas',names:['Oxygen','Ox\u00edgeno','Oxig\u00eanio']},
 methane_gas:{texture:'textures/static/images/methane_gas',names:['Methane','Metano','Metano']},
 'utilitycraft:charcoal_dust':{texture:'textures/items/dusts/charcoal_dust',names:['Charcoal Dust','Polvo de carb\u00f3n vegetal','P\u00f3 de carv\u00e3o vegetal']},
};
const localeNames=['en_US','es_MX','pt_BR'];
const translations=localeNames.map(()=>({}));
function translate(key,values){values.forEach((v,i)=>translations[i][key]=v);return key;}
const visible=(control)=>[{binding_type:'view',source_control_name:control,source_property_name:'#toggle_state',target_property_name:'#visible',resolve_sibling_scope:false}];
function image(texture,size,offset,layer=2){return {type:'image',texture,size,offset,anchor_from:'top_left',anchor_to:'top_left',layer};}
function label(text,size,offset,scale=0.55){return {type:'label',text,size,offset,anchor_from:'top_left',anchor_to:'top_left',text_alignment:'left',font_scale_factor:scale,color:[1,1,1],shadow:true,layer:8};}
const common={namespace:'uc'};
// Keep the working standard selector; draw both output icons above it.
// recipe_pair_hover copies Mojang slot_enabled_hover pixels with 1px nine-slice metadata,
// matching the scalable normal/selected recipe textures at rectangular sizes.
common.fluid_pair_recipe_toggle={type:'panel',size:[42,18],
 '$recipe_icon|default':'','$recipe_icon_2|default':'','$pair_default_state|default':false,controls:[
  {'button@uc.recipe_toggle':{size:[42,18],$toggle_size:[42,18],$has_toggle_icon:false,$toggle_default_state:'$pair_default_state',$toggle_unchecked_hover:'textures/ui/recipe_pair_hover',$toggle_checked_hover:'textures/ui/recipe_pair_hover'}},
  {first_icon:image('$recipe_icon',[16,16],[2,1],1)},
  {plus:{...label('+',[6,10],[18,4],0.8),layer:1}},
  {second_icon:image('$recipe_icon_2',[16,16],[24,1],1)}
 ]};
common['fluid_recipe_ingredient@uc.recipe_toggle']={size:[16,16],$toggle_size:[16,16],$toggle_icon_size:[16,16],$toggle_group:false,$toggle_layer:7,
 $toggle_unchecked:'textures/ui/slots/transparent_slot',$toggle_checked:'textures/ui/slots/transparent_slot',
 $toggle_unchecked_hover:'textures/ui/slots/transparent_slot',$toggle_checked_hover:'textures/ui/slots/transparent_slot'};
write('RP/ui/recipes/fluid_core.json',common);
for(const machine of ['electrolyzer','chemical_converter']){
 const script=fs.readFileSync('BP/scripts/config/recipes/'+machine+'.js','utf8');
 const match=script.match(/const defaultRecipes = (\{[\s\S]*?\n\});/);assert(match,'default recipes');
 const recipes=JSON.parse(match[1]);
 const live=read('RP/ui/'+machine+'.json');
 const top=live[machine+'_top'];
 top['$energy_bar_offset|default']=[-101,-13];
 top['$energy_bar_bg_texture|default']='textures/ui/toggle_button/left_bg';
 const energy=top.controls.find(c=>c['energy@uc.energy_bar'])['energy@uc.energy_bar'];
 energy.offset='$energy_bar_offset';energy.$bar_bg_texture='$energy_bar_bg_texture';
 top.controls=top.controls.filter(c=>!Object.keys(c).some(k=>k.startsWith('recipe_overlays@')));
 const defs={namespace:'uc'};
 const buttons={type:'stack_panel',anchor_from:'top_left',anchor_to:'top_left',size:[126,'100%c'],offset:[0,-1],orientation:'vertical',controls:[]};
 const preview={type:'collection_panel',anchor_from:'center',anchor_to:'center',size:[162,72],collection_name:'container_items',$item_collection_name:'container_items',bindings:visible('recipes_toggle_button'),controls:[]};
 const recipeControls=[];
 let index=0;
 for(const [key,recipe] of Object.entries(recipes)){
  const id=machine+'_'+index,select=id+'_recipe',prefix='ui.utilitycraft:recipe.'+id;
  const inputs=key.split('|');
  const parts=[];
  const lookup=k=>top.controls.find(c=>c[k])?.[k];
  const bar=(control,type,amount,outline,role)=>{if(!type||type==='empty'||!amount)return;const offset=lookup(control).offset;parts.push({type,amount,outline,role,x:93.1+offset[0],bottom:65+offset[1],kind:'fluid'});};
  if(machine==='electrolyzer'){
   bar('input@uc.liquid_input_1_bar',inputs[0],recipe.required_liquid,'input_1',0);
   bar('gas_input@uc.liquid_input_2_bar',inputs[1],recipe.required_gas,'input_2',0);
   bar('output1@uc.liquid_output_1_bar',recipe.output1.type,recipe.output1.amount,'output_1',1);
   bar('output2@uc.liquid_output_2_bar',recipe.output2.type,recipe.output2.amount,'output_2',1);
  }else{
   if(inputs[0]!=='empty'&&recipe.required_items)parts.push({type:inputs[0],amount:recipe.required_items,outline:'input_1',role:0,x:81+lookup('input_item@uc.input_1_slot').offset[0],kind:'item',slotIndex:lookup('input_item@uc.input_1_slot').collection_index,slotY:lookup('input_item@uc.input_1_slot').offset[1]});
   bar('input_liquid@uc.liquid_input_2_bar',inputs[1],recipe.required_liquid,'input_2',0);
   bar('input_gas@uc.liquid_input_3_bar',inputs[2],recipe.required_gas,'input_3',0);
   bar('output_gas@uc.liquid_output_1_bar',recipe.output_gas.type,recipe.output_gas.amount,'output_1',1);
  }
  const outputs=parts.filter(p=>p.role===1);
  const tooltip=translate(prefix+'.summary',localeNames.map((_,lang)=>outputs.map(p=>resources[p.type].names[lang]).join('\\n')));
  const toggle={$toggle_name:machine+'_recipes',$toggle_index:index,$toggle_control_name:select,$toggle_hover_text:tooltip,$toggle_default_state:index===0,$recipe_icon:resources[outputs[0].type].texture,anchor_from:'top_left',anchor_to:'top_left',offset:[0,0]};
  if(outputs.length===2){
   toggle.$recipe_icon_2=resources[outputs[1].type].texture;
   // Standard recipe toggles fill the row and center their 18px native button.
   // Match that left edge; anchoring the 42px wrapper at row origin clips it.
   toggle.anchor_from='center';toggle.anchor_to='left_middle';toggle.offset=[-9,0];
   // The child recipe_toggle sets its own default state; forward it explicitly.
   toggle.$pair_default_state=toggle.$toggle_default_state;
   delete toggle.$toggle_default_state;
  }
  buttons.controls.push({['row_'+index]:{type:'panel',size:[126,20],controls:[{[id+'_toggle@uc.'+(outputs.length===2?'fluid_pair_recipe_toggle':'recipe_toggle')]:toggle}]}});
  const controls=[];
  for(let n=0;n<parts.length;n++){
   const p=parts[n],resource=resources[p.type];assert(resource,p.type);
   if(p.kind==='item'){
    const slot={collection_index:p.slotIndex,$slot_offset:[p.x-81,p.slotY-27],$slot_red_size:[16,16],$slot_item_texture:resource.texture,$has_slot_hover:false,$has_slot_count:p.amount>1};
    if(p.amount>1)slot.$slot_count_text=String(p.amount);
    controls.push({['item_'+n+'@uc.recipe_slot_overlay']:slot});
    continue;
   }
   const detail=translate(prefix+'.ingredient_'+n,localeNames.map((_,lang)=>resource.names[lang]+'\\n'+(p.role?['Produces','Produce','Produz'][lang]:['Requires','Requiere','Requer'][lang])+': '+p.amount+' mB'));
   // Overlay the bottom 16px of the live bar; preserve its frame and real contents.
   controls.push({['fluid_'+n+'@uc.fluid_recipe_ingredient']:{anchor_from:'top_left',anchor_to:'top_left',offset:[p.x-8,p.bottom-16],$recipe_icon:resource.texture,$toggle_control_name:id+'_ingredient_'+n,$toggle_name:id+'_ingredient_'+n,$toggle_hover_text:detail}});
  }
  recipeControls.push({[id+'_preview']:{type:'collection_panel',size:[162,72],collection_name:'container_items',$item_collection_name:'container_items',bindings:visible(select),controls}});
  index++;
 }
 preview.controls.push(...recipeControls);
 defs[machine+'_recipes_panel']=preview;
 defs[machine+'_recipes_buttons']=buttons;
 defs[machine+'_recipes_side_panel']=JSON.parse(JSON.stringify(book.crusher_recipes_side_panel).replaceAll('crusher_recipes_buttons',machine+'_recipes_buttons'));
 defs[machine+'_recipes_connector']=structuredClone(book.crusher_recipes_connector);
 write('RP/ui/recipes/'+machine+'.json',defs);
 top.controls.push({['recipe_overlays@uc.'+machine+'_recipes_panel']:{}});
 // Both views render the same live machine; only its enclosing panel is displaced.
 const root=JSON.parse(JSON.stringify(crusher.utility_panel).replaceAll('crusher',machine));
 function route(o,inRecipe=false){for(const[k,v]of Object.entries(o)){
  if(k===machine+'_top@'+machine+'.'+machine+'_top'&&inRecipe){
   v.$energy_bar_offset=[97,64];v.$energy_bar_bg_texture='textures/ui/toggle_button/right_bg';
   v.$io_gases_toggle_control_name='io_gases_toggle_button_recipes';
  }
  if(v&&typeof v==='object')route(v,inRecipe||k==='recipes_content');
 }}route(root);
 live.utilitycraft_panel=root;
 write('RP/ui/'+machine+'.json',live);
}
for(let i=0;i<localeNames.length;i++){
 const file='RP/texts/'+localeNames[i]+'.lang';let text=fs.readFileSync(file,'utf8');
 text=text.split(/\r?\n/).filter(l=>!/^ui\.utilitycraft:recipe\.(electrolyzer|chemical_converter)_\d+\./.test(l)).join('\n').trimEnd();
 text+='\n'+Object.entries(translations[i]).map(([k,v])=>k+'='+v).join('\n')+'\n';fs.writeFileSync(file,text);
}
const defs=read('RP/ui/_ui_defs.json');for(const file of ['fluid_core','electrolyzer','chemical_converter']){const p='ui/recipes/'+file+'.json';if(!defs.ui_defs.includes(p))defs.ui_defs.push(p);}write('RP/ui/_ui_defs.json',defs);
console.log('Generated both recipe books from the default runtime recipes.');
