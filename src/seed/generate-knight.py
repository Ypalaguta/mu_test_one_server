"""Deterministic catalogue generator; run from server root. No database access.
Definitions are full snapshots per rank. Combat handlers are deliberately out of scope.
"""
import copy, json
from pathlib import Path
D=Path('data')
def read(n): return json.loads((D/n).read_text(encoding='utf-8'))
def write(n,v): (D/n).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
# Base definitions are editable data, never imported as executable code.
legacy=json.loads(Path('src/seed/knight-base.json').read_text(encoding='utf-8'))
F=[]
for key,name,unlock,target,duration,cd,gear,desc,params in legacy:
 F.append(dict(key=key,name=name,target=target,duration=duration,cd=cd,gear=gear,desc=desc,
  params={k:a for k,(a,b) in params.items()},upgrades=[('Martial' if 'damage' in k.lower() else 'Guardian',k,b) for k,(a,b) in params.items() if b],
  kind='Passive' if len(F)>=17 else 'Toggle' if key=='blood_covenant' else 'Active'))
def edit(key,**kw): next(f for f in F if f['key']==key).update(kw)
def add(key,name,levels,target,gear,kind,desc,params,upgrades,tags,duration=0,cd=15):
 F.append(dict(key=key,name=name,levels=levels,target=target,gear=gear,kind=kind,desc=desc,params=params,upgrades=upgrades,tags=tags,duration=duration,cd=cd))
SCHEDULES=[
[1,9,21,35,41,55,72,86,91,106,120], [2,13,27,39,43,59,75,89,94,110], [3,15,29,42,58,76,93,108],
[48,62,78,90,95,109,119], [7,23,37,49,65,81,97,113], [4,17,33,44,60,79,92,107],
[19,32,46,64,82,96,112], [6,20,36,47,66,84,98,114], [5,18,31,45,61,80,99,115],
[8,24,38,51,68,85,100,116], [28,40,54,70,87,103,117], [16,30,52,69,88,101,118],
[34,56,73,90,104,119], [91,102,116], [93,105,120], [96,108,120], [57,74,89,95,111,120],
[10,22,36,50,67,83,97,113], [12,26,40,53,71,88,102,118], [1,14,28,42,58,77,92,109],
[11,25,39,55,72,86,100,115], [27,38,54,70,85,99,114], [3,16,29,44,60,78,94,110], [13,26,39,52,68,84,98,112]]
for f,levels in zip(F,SCHEDULES):f['levels']=levels
edit('parry',desc='Enter a facing-locked stance. Movement is allowed; attacks and other casts are disabled. A qualifying frontal targeted attack triggers the counter before health damage.',
 params={'facingLocked':1,'otherActionsBlocked':1,'triggerAngleDegrees':80,'counterDamageMultiplier':1.2,'charges':1},
 upgrades=[('Martial','counterDamageMultiplier',.2),('Guardian','triggerAngleDegrees',2),('Arcane','counterSlowSeconds',.2)])
edit('spell_reflection',name='Mirror Shield',desc='Reflect frontal projectiles geometrically; reflected projectiles can hit allies. Only physical damage reaching health drains Resonance. Final-stage ranks can also reflect targeted spells.',
 params={'coneDegrees':60,'reflectedDamagePct':70,'physicalHpDamageResourceLossPct':30,'friendlyFire':1},
 upgrades=[('Arcane','reflectedDamagePct',5),('Guardian','coneDegrees',2)])
for key in ['challenge','mass_challenge']:
 edit(key,desc='Mark enemies: ordinary enemies must attack the Knight; players retain control. Marked targets deal less damage to others and more to the Knight. Resource variants can counter marked attackers.',
 params={'radius':450,'damageToOthersReductionPct':15,'damageToKnightBonusPct':10,'threatBonus':100} if key=='mass_challenge' else {'damageToOthersReductionPct':15,'damageToKnightBonusPct':10,'threatBonus':100},
 upgrades=[('Guardian','damageToOthersReductionPct',2),('Martial','counterDamageMultiplier',.15),('Arcane','counterSlowSeconds',.25)])
edit('healing_prayer',name='Mending Prayer',target='Ally',desc='Apply a targeted heal to one ally, including yourself.',upgrades=[('Guardian','healMaxHpPct',2),('Arcane','manaEfficiencyPct',3)])
edit('judgment_charge',gear='shield')
edit('guardians_oath',name='Chains of the Oath',target='Ally',desc='Mark an ally. An attack against that ally triggers a hypnotic chain pulling the attacker toward the Knight. The mark jumps to another random ally up to its jump limit.',
 params={'markJumps':2,'triggerInternalCooldown':1,'pullDistance':800,'partyRange':1000},upgrades=[('Guardian','markJumps',1),('Arcane','pullDistance',100)])
edit('unyielding',desc='At low health, a successful defensive trigger reduces the Parry cooldown, subject to an internal cooldown. After level 40, defensive resource rewards improve and meaningful healing can reduce a cooldown.',
 params={'lowHpThresholdPct':30,'lowHpParryCooldownReductionSeconds':.25,'lowHpTriggerCooldown':5},upgrades=[('Guardian','lowHpParryCooldownReductionSeconds',.1)])
add('sweeping_strike','Sweeping Strike',[9,22,35,47,63,80,95,111],'Self','sword','Active','Sweep the sword through a frontal area.',
 {'damageMultiplier':.8,'radius':280,'coneDegrees':110},[('Martial','damageMultiplier',.15),('Guardian','enemyDamageReductionPct',2),('Arcane','radius',15)],'Attack Physical Melee Sword OneHanded AoE',cd=9)
add('shield_throw','Shield Throw',[14,25,37,46,62,79,92,107,119],'Enemy','shield','Active',
 'Throw the shield, interrupt the current cast, and return. Shield defense is unavailable during flight. Variants bounce to enemies, steal a buff, or bounce to allies with barriers.',
 {'damageMultiplier':.9,'interruptCast':1,'shieldUnavailableInFlight':1,'throwRange':900},[('Martial','damageMultiplier',.15),('Guardian','fortitudeAllyBarrier',50),('Arcane','throwRange',40)],'Attack Physical Shield Projectile Target',cd=16)
add('backstep','Backstep',[15,30,48,65,82,96,113],'Self','','Active','Leap backward without changing facing. The base move does not grant invulnerability.',
 {'distance':450},[('Arcane','distance',25),('Guardian','fortitudeBarrier',50),('Martial','retributionNextAttackBonusPct',3)],'Movement',cd=12)
add('shield_stance','Shield Stance',[17,31,45,64,81,97,114],'Self','shield','Active',
 'Lock facing, slow movement and block within a narrow frontal angle. Attacks and other casts are disabled; cancelling is always allowed. Return part of blocked damage to enemies in front.',
 {'facingLocked':1,'otherActionsBlocked':1,'movementPenaltyPct':60,'blockAngleDegrees':60,'returnedBlockedDamagePct':15},
 [('Guardian','blockAngleDegrees',2),('Martial','returnedBlockedDamagePct',3),('Arcane','resonanceBlockRewardMultiplier',.1)],'Shield Buff Duration Trigger',duration=5,cd=20)
add('group_prayer','Prayer of Fellowship',[24,38,53,71,87,101,117],'Self','','Active','Apply the same targeted heal separately to every eligible nearby party member.',
 {'radius':700,'healMaxHpPct':8},[('Guardian','healMaxHpPct',1.5),('Arcane','radius',30)],'Spell Heal AoE',cd=30)
add('mass_arrest','Mass Arrest',[63,77,89,104,118],'Self','','Channel','Channel to root enemies in the area. The Knight cannot move while maintaining the prison.',
 {'radius':450,'rootRefreshSeconds':.5},[('Guardian','radius',25),('Arcane','resonanceSpellSuppressionPct',3)],'Spell AoE Duration Channeling Debuff',duration=5,cd=28)
add('aegis','Aegis',[18,33,49,66,83,98,116],'Self','shield','Active','Gain a finite damage-absorption barrier, separate from health.',
 {'barrierAmount':150},[('Guardian','barrierAmount',75),('Martial','retributionBreakDamage',40)],'Shield Buff Duration',duration=6,cd=24)
add('unbroken_vow','Unbroken Vow',[69,84,90,103,117],'Ally','','Active','Negate the next eligible negative effect and then grant an absorption barrier.',
 {'negatedEffects':1,'barrierAmount':250},[('Guardian','barrierAmount',75),('Arcane','resonanceResourceGain',5)],'Spell Target Buff Duration Trigger',duration=8,cd=30)
add('inner_resolve','Inner Resolve',[41,56,73,88,102,118],'Self','','Active','Spend mana to gain a chosen additional resource. The executor uses the selected resource, not the dominant resource.',
 {'resourceGain':20,'manaCost':25},[('Arcane','resourceGain',3)],'Spell Buff')
add('release_guard','Release Guard',[43,59,76,90,105,119],'Self','','Active','Consume Fortitude and break your own barrier to empower attacks. Sacrifice does not generate hit or absorption resources.',
 {'fortitudeCost':20,'sacrificedBarrierDamagePct':30,'damageBonusPct':15,'armorPenaltyPct':20},[('Martial','damageBonusPct',3),('Guardian','sacrificedBarrierDamagePct',5),('Arcane','attackSpeedBonusPct',2)],'Buff Duration Attack',duration=5,cd=16)
add('resource_exchange','Balance of the Oath',[50,67,85,100,115],'Self','','Active','Convert a selected resource into a different selected resource at a loss. Conversion cannot trigger resource-gain loops.',
 {'sourceCost':30,'targetGain':20},[('Arcane','targetGain',1)],'Spell',cd=10)
add('sanctuary','Sanctuary',[91,106,120],'Self','','Channel','Lower the weapon and channel barriers for nearby party members. No direct healing. The weapon is visually lowered, not unequipped.',
 {'radius':800,'barrierPerPulse':100,'pulseSeconds':1,'maxBarrierPerAlly':600},[('Guardian','barrierPerPulse',25),('Arcane','radius',40)],'Spell AoE Channeling Duration Buff',duration=6,cd=40)
# Variants are per-executor parameters, not an attempt to implement generic combat.
V={
 'sword_strike':[('Fortitude',{'fortitudeBarrier':100}),('Retribution',{'retributionDamageMultiplier':1.8}),('Resonance',{'resonanceDisruptSeconds':.5})],
 'parry':[('Fortitude',{'fortitudeBarrier':150}),('Retribution',{'retributionCounterDamageMultiplier':2}),('Resonance',{'resonanceCounterSilenceSeconds':.5})],
 'shield_bash':[('Fortitude',{'fortitudeBarrier':120}),('Retribution',{'retributionDamageMultiplier':1.4}),('Resonance',{'resonanceDispelCount':1})],
 'spell_reflection':[('Resonance',{'resonanceReflectionBonusPct':20}),('Fortitude',{'fortitudeBarrier':180}),('Retribution',{'retributionReflectionBonusPct':15})],
 'grappling_chain':[('Fortitude',{'fortitudeBarrier':100}),('Retribution',{'retributionDamageMultiplier':1}),('Resonance',{'resonanceBuffStealCount':1})],
 'challenge':[('Fortitude',{'fortitudeBarrier':180}),('Retribution',{'retributionCounterChancePct':25,'counterInternalCooldown':1}),('Resonance',{'resonanceCounterDamageDebuffPct':10})],
 'mass_challenge':[('Fortitude',{'fortitudeBarrier':250}),('Retribution',{'retributionCounterChancePct':20,'counterInternalCooldown':1}),('Resonance',{'resonanceCounterSlowSeconds':1})],
 'arrest':[('Fortitude',{'fortitudeBarrier':100}),('Retribution',{'retributionTargetArmorReductionPct':10}),('Resonance',{'resonanceRootSeconds':5})],
 'judgment_charge':[('Fortitude',{'fortitudeBarrier':200}),('Retribution',{'retributionImpactRadius':250}),('Resonance',{'resonanceSpellWardSeconds':3})],
 'healing_prayer':[('Fortitude',{'fortitudeAllyBarrier':200}),('Resonance',{'resonanceCleanseCount':1}),('Retribution',{'retributionAllyDamageBonusPct':10,'retributionAllyBuffSeconds':4})],
 'tribunal':[('Fortitude',{'fortitudeBarrier':150}),('Retribution',{'retributionDamageMultiplier':2.4}),('Resonance',{'resonanceBuffStealCount':1})],
 'aura_of_restraint':[('Fortitude',{'fortitudePartyBarrier':100}),('Retribution',{'retributionVulnerabilityPct':8}),('Resonance',{'resonanceSpellDamageReductionPct':15})],
 'last_stand':[('Fortitude',{'fortitudeBarrier':300}),('Retribution',{'retributionAttackSpeedBonusPct':15}),('Resonance',{'resonanceNextDebuffNegation':1})],
 'guardians_oath':[('Fortitude',{'fortitudeAllyBarrier':250}),('Retribution',{'retributionAttackerArmorReductionPct':12}),('Resonance',{'resonanceHypnosisSeconds':2})],
 'spell_intercession':[('Resonance',{'resonanceReflectionDamagePct':40}),('Fortitude',{'fortitudeBarrier':350}),('Retribution',{'retributionReflectionDamagePct':30})],
 'purging_verdict':[('Resonance',{'resonanceExtraDurationPct':20}),('Fortitude',{'fortitudeBarrierPerEffect':50}),('Retribution',{'retributionDamagePerEffect':50})],
 'blood_covenant':[('Retribution',{'retributionPartyDamageBonusPct':10}),('Fortitude',{'fortitudePartyBarrier':200}),('Resonance',{'resonancePartySpellProtectionPct':12})],
 'sweeping_strike':[('Retribution',{'retributionDamageMultiplier':1.6}),('Fortitude',{'fortitudeBarrierPerTarget':50}),('Resonance',{'resonanceSlowSeconds':2})],
 'shield_throw':[('Retribution',{'retributionEnemyBounces':2}),('Fortitude',{'fortitudeAllyBounces':2,'fortitudeAllyBarrier':150}),('Resonance',{'resonanceBuffStealCount':1})],
 'backstep':[('Fortitude',{'fortitudeBarrier':180}),('Resonance',{'resonanceSpellRewardMultiplier':1.5,'resonanceRewardSeconds':3}),('Retribution',{'retributionNextAttackBonusPct':15})],
 'shield_stance':[('Fortitude',{'fortitudeBlockRewardMultiplier':2}),('Retribution',{'retributionReturnedDamageBonusPct':20}),('Resonance',{'resonanceBlockRewardMultiplier':1.5})],
 'group_prayer':[('Fortitude',{'fortitudePartyBarrier':150}),('Resonance',{'resonanceCleanseCount':1}),('Retribution',{'retributionPartyDamageBonusPct':8,'retributionBuffSeconds':4})],
 'mass_arrest':[('Fortitude',{'fortitudeBarrier':300}),('Retribution',{'retributionArmorReductionPct':10}),('Resonance',{'resonanceSpellSuppressionPct':15})],
 'aegis':[('Fortitude',{'fortitudeBarrier':250}),('Retribution',{'retributionBreakDamage':150}),('Resonance',{'resonanceSpellRewardMultiplier':1.5})],
 'unbroken_vow':[('Fortitude',{'fortitudeBarrier':300}),('Resonance',{'resonanceResourceGain':15}),('Retribution',{'retributionAllyDamageBonusPct':10,'retributionBuffSeconds':4})],
 'sanctuary':[('Fortitude',{'fortitudeBarrierBonusPct':30}),('Resonance',{'resonanceNextDebuffNegation':1}),('Retribution',{'retributionAllyDamageBonusPct':10})]}

VARIANT_UPGRADES = {
 'sword_strike':[('Guardian','fortitudeBarrier',50),('Arcane','resonanceDisruptSeconds',.15)],
 'parry':[('Guardian','fortitudeBarrier',50),('Martial','retributionCounterDamageMultiplier',.2)],
 'shield_bash':[('Guardian','fortitudeBarrier',50)],
 'spell_reflection':[('Guardian','fortitudeBarrier',50),('Martial','retributionReflectionBonusPct',5)],
 'grappling_chain':[('Guardian','fortitudeBarrier',50),('Martial','retributionDamageMultiplier',.15)],
 'challenge':[('Martial','retributionCounterChancePct',5),('Guardian','fortitudeBarrier',50)],
 'mass_challenge':[('Martial','retributionCounterChancePct',5),('Guardian','fortitudeBarrier',50)],
 'arrest':[('Arcane','resonanceRootSeconds',.25),('Guardian','fortitudeBarrier',50)],
 'judgment_charge':[('Guardian','fortitudeBarrier',50),('Martial','retributionImpactRadius',25)],
 'healing_prayer':[('Guardian','fortitudeAllyBarrier',50),('Martial','retributionAllyDamageBonusPct',2)],
 'tribunal':[('Guardian','fortitudeBarrier',50)],
 'aura_of_restraint':[('Martial','retributionVulnerabilityPct',2),('Arcane','resonanceSpellDamageReductionPct',2)],
 'last_stand':[('Guardian','fortitudeBarrier',50)],
 'blood_covenant':[('Guardian','fortitudePartyBarrier',50),('Arcane','resonancePartySpellProtectionPct',2)],
 'sweeping_strike':[('Guardian','fortitudeBarrierPerTarget',25)],
 'group_prayer':[('Guardian','fortitudePartyBarrier',50)],
 'aegis':[('Arcane','resonanceSpellRewardMultiplier',.1)]
}
for f in F:f['upgrades']+=VARIANT_UPGRADES.get(f['key'],[])

# Explicit labels: passive/support identity can remain constant while rank changes.
NAMES={
'sword_strike':['Sword Strike','Resolute Strike','Sovereign Strike'], 'parry':['Parry','Patient Reprisal','Perfect Reprisal'],
'shield_bash':['Shield Bash','Bastion Bash','Judgment Bash'], 'spell_reflection':['Mirror Shield','Mirror Shield','Prismatic Reversal'],
'grappling_chain':['Grappling Chain','Binding Chain','Sovereign Chain'], 'challenge':['Challenge','Punishing Challenge','Sovereign Challenge'],
'mass_challenge':['Rallying Challenge','Punishing Rally','Sovereign Rally'], 'arrest':['Arrest','Binding Arrest','Royal Arrest'],
'judgment_charge':['Shield Charge','Judgment Charge','Sovereign Charge'], 'healing_prayer':['Mending Prayer','Resolute Prayer','Sovereign Prayer'],
'tribunal':['Tribunal','Severe Tribunal','Final Tribunal'], 'sweeping_strike':['Sweeping Strike','Resolute Sweep','Sovereign Sweep'],
'shield_throw':['Shield Throw','Resonant Shield','Sovereign Shield'], 'shield_stance':['Shield Stance','Bastion Stance','Living Bastion'],
'aegis':['Aegis','Tempered Aegis','Sovereign Aegis']}
TAG_OVERRIDES={
'sword_strike':'Attack Physical Melee Sword OneHanded Target','parry':'Attack Buff Duration OneHanded Trigger',
'shield_bash':'Attack Physical Melee Shield Target Duration Debuff','spell_reflection':'Spell Shield Buff Duration Projectile',
'grappling_chain':'Spell Target Movement Physical Debuff','challenge':'Warcry Target Duration Debuff','mass_challenge':'Warcry AoE Duration Debuff',
'arrest':'Spell Target Duration Debuff','judgment_charge':'Attack Shield Physical Target Movement Duration Debuff',
'healing_prayer':'Spell Heal Target','tribunal':'Attack Physical Melee Sword OneHanded Target Duration Debuff',
'aura_of_restraint':'Warcry AoE Duration Debuff','last_stand':'Buff Duration Attack Movement',
'guardians_oath':'Spell Target Duration Trigger Buff','spell_intercession':'Spell AoE Duration Buff',
'purging_verdict':'Spell AoE Debuff','blood_covenant':'Aura AoE Buff','unyielding':'Passive Trigger',
'shield_discipline':'Passive Shield','shield_mastery':'Passive Shield'}
# Add meaningful upgrades only on otherwise empty levels, choosing a long existing gap.
for lv in range(1,121):
 if any(lv in f['levels'] for f in F):continue
 eligible=[f for f in F if min(f['levels'])<lv and all(abs(lv-v)>2 for v in f['levels'])]
 assert eligible,lv
 chosen=max(eligible,key=lambda f:(min(abs(lv-v) for v in f['levels']),-len(f['levels'])))
 chosen['levels']=sorted(chosen['levels']+[lv])
OLD_BOOK_IDS={70000+i*10+r for i in range(24) for r in range(2,11)}
NEW_BOOK_IDS=set(range(80001,80007))|{81000+i*2+s for i in range(len(F)) for s in range(2)}
catalogue=read('items.json')
book_descriptions={(i['id'],i['name']):i['description'] for i in catalogue if i['id'] in NEW_BOOK_IDS and i.get('description')}
items=[i for i in catalogue if i['id'] not in OLD_BOOK_IDS|NEW_BOOK_IDS]
zero={k:0 for k in read('classes.json')[0]['baseStats']};books={};skills=[];rows=[]
def book(bid,name,level,desc):
 desc=book_descriptions.get((bid,name),desc)
 books[bid]=dict(id=bid,name=name,itemLevel=level,type='Misc',slot='None',inventoryTab='Misc',maxStack=99,weight=100,iconName='Knight_SkillBook',description=desc,stats=zero.copy())
for ix,doctrine in enumerate(['Martial','Guardian','Arcane']):
 for tier in [1,2]:book(80001+ix+(tier-1)*3,('Advanced ' if tier==2 else '')+doctrine+' Doctrine',41 if tier==1 else 91,'Consumed for '+doctrine.lower()+' upgrades. Learn through the Skills window.')
for fi,f in enumerate(F):
 params=copy.deepcopy(f['params']);prev=0;seen=set();unlocked=set();upgrade_index=0
 for rank,lv in enumerate(f['levels'],1):
  tier=0 if lv<=40 else 1 if lv<=90 else 2;first=tier not in seen;seen.add(tier)
  name=NAMES.get(f['key'],[f['name']]*3)[tier];notes=[];doctrine='Guardian' if f['kind']=='Passive' else 'Martial'
  if rank==1:notes.append('Unlock '+name+'.')
  else:
   eligible=[u for u in f['upgrades'] if not u[1].startswith(('fortitude','retribution','resonance')) or u[1] in params]
   doctrine,key,amount=eligible[upgrade_index%len(eligible)];upgrade_index+=1
   params[key]=round(params.get(key,0)+amount,3);notes.append(f'{key} +{amount:g} (now {params[key]:g}).')
  variants=V.get(f['key'],[])
  if tier and len(unlocked)<len(variants):
   resource,bonuses=variants[len(unlocked)];unlocked.add(resource)
   params.update({resource.lower()+'VariantEnabled':1,resource.lower()+'Threshold':30,resource.lower()+'Cost':20})
   for key,value in bonuses.items():params[key]=max(params.get(key,0),value)
   notes.append('Unlock '+resource+' variant.');doctrine={'Fortitude':'Guardian','Retribution':'Martial','Resonance':'Arcane'}[resource]
  if tier==2 and first and f['key']=='spell_reflection':params['targetedSpellReflection']=1;notes.append('Can now reflect targeted spells.')
  if tier and first and f['key']=='unyielding':params.update(lowHpBlockRewardMultiplier=1.25 if tier==1 else 1.5,recoveryCooldownReductionSeconds=.5 if tier==1 else 1,recoveryInternalCooldown=5,recoveryMinMaxHpPct=5);notes.append('Meaningful recovery reduces a cooldown.')
  cost=[dict(type='Gold',id=0,amount=100*rank*rank),dict(type='SkillPoints',id=0,amount=1+tier+(rank-1)//4)];bid=None
  if tier:
   if first:
    bid=81000+fi*2+tier-1
    book(bid,'Skill Book: '+name+(' - Awakening' if tier==1 else ' - Ascension'),lv,'Consumed for the first '+('awakened' if tier==1 else 'advanced')+' rank of '+name+'. Later ranks use shared doctrine books.')
   else:bid=80001+['Martial','Guardian','Arcane'].index(doctrine)+(tier-1)*3
   cost.append(dict(type='Item',id=bid,amount=1))
  sid=20001+fi*100+rank-1;simple=f['key'] in ['arcane_resilience','vitality','shield_discipline'];stats=zero.copy()
  if simple:stats.update({k:v for k,v in params.items() if k in stats})
  tags=['Skill']+TAG_OVERRIDES.get(f['key'],f.get('tags','Passive' if f['kind']=='Passive' else 'Spell')).split()
  if f['key']=='shield_throw' and 'Retribution' in unlocked:tags.append('Chaining')
  desc=f['desc']
  if unlocked:desc+=' Available resource variants: '+', '.join(sorted(unlocked))+'. Only one is chosen per cast.'
  skill=dict(id=sid,familyId=2001+fi,level=rank,prev=prev,replaces=[],modifierOfSkill=0,name=name,description=desc,upgradeDescription=' '.join(notes),executionId='' if simple else 'knight.'+f['key'],
   needTargetSelected=f['target'] in ['Enemy','Ally'],allowedTarget=f['target'],tags=tags,aggro=int(params.get('threatBonus',0)),
   useRange=900 if f['key'] in ['shield_throw','judgment_charge'] else 180 if f['gear'] in ['sword','shield'] and f['target']=='Enemy' else 800 if f['target'] in ['Enemy','Ally'] else 0,
   canBeInterrupted=f['kind']=='Channel' or 'prayer' in f['key'],canWalkDuringActivation=f['kind']!='Channel' and 'prayer' not in f['key'],useTime=1.5 if 'prayer' in f['key'] else 0,
   hasGCd=f['kind']!='Passive',cooldown=f['cd'],buffApply=[],debuffApply=[],skillUseType=f['kind'],resource={'Mp':int(params.get('manaCost',8+tier*4))} if f['kind'] not in ['Passive','Toggle'] else {},
   requirements=[dict(type='CharacterLevel',id=0,amount=lv)],cost=cost,stats=stats,iconName='Knight_'+f['key'],duration=f['duration'],effectParameters=copy.deepcopy(params),
   activationRequirements=dict(requiresShield=f['gear']=='shield',requiresOneHandWeapon=f['gear'] in ['sword','onehand'],requiresSword=f['gear']=='sword',healthBelowPercent=30 if f['key']=='last_stand' else 0))
  skills.append(skill);rows.append((lv,skill,bid));prev=sid
write('skills.json',skills);write('items.json',items+list(books.values()))
classes=read('classes.json')
for c in classes:
 c['skillIds']=[s['id'] for s in skills if not s['prev']] if c['id']==1 else []
 if c['id']==1:c['name']='Knight'
write('classes.json',classes)
monsters=read('monsters.json')
for m in monsters:m['skillIds']=[]
write('monsters.json',monsters)
chars=read('characters.json')
for c in chars:
 c['progress']['accessible']=[2001+i for i in range(len(F))] if c['info']['classId']==1 else []
 c['progress']['learned']=[];c['progress']['selectedModifiers']=[];c['aiSettings']['allowedSkillIds']=[]
 c['actionBarSlots']=[s for s in c['actionBarSlots'] if s['type']!='Skill' and not(s['type']=='Item' and s['id'] in OLD_BOOK_IDS)]
 c['progress']['inventory']=[s for s in c['progress']['inventory'] if s.get('itemId') not in OLD_BOOK_IDS]
write('characters.json',chars)
lines=['# Knight progression: levels 1–120','',f'{len(F)} families; {len(skills)} ranks; {len(books)} books. Combat parameters are design data, not implemented handlers.','','| Family | Ranks | Learning levels |','|---|---:|---|']
for i,f in enumerate(F):lines.append(f"| {2001+i}: {f['name']} | {len(f['levels'])} | {', '.join(map(str,f['levels']))} |")
lines+=['','## Level-by-level upgrades','','Each rank replaces the previous one only when learned. Gold and skill points are required in addition to the listed book.','','| Level | Skill (rank / ID) | Changes | Book |','|---:|---|---|---|']
for lv,s,bid in sorted(rows,key=lambda r:(r[0],r[1]['id'])):lines.append(f"| {lv} | {s['name']} ({s['level']} / {s['id']}) | {s['upgradeDescription']} | {books[bid]['name'] if bid else 'None'} |")
Path('KNIGHT_CATALOG.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
Path('knight-icons.txt').write_text('\n'.join(f'"Knight_{f["key"]}":"{f["name"]}"\tspecial_wait' for f in F)+'\n"Knight_SkillBook":"Knight Skill Books"\tspecial_wait\n',encoding='utf-8')
print(f'{len(skills)} ranks / {len(F)} families / {len(books)} books; {len(items)} existing items preserved')
