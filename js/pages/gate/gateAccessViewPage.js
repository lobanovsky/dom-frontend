import { buildingsApi, gateApi, premisesApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { copyPhoneCell } from '../../ui/copyPhone.js';
import { formatPhone, isActiveOn, todayIso } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { renderTable } from '../../ui/table.js';
import { saveFile } from '../../ui/saveFile.js';
import { bindGatePhoneInput, gateVehicles, gateVehicleLabel, gateZoneLabel, groupGateRequests, GATE_RELATIONS, gatePremisesTone, gateOwnersFirst } from '../../lib/gate.js';
import { openModal } from '../../ui/modal.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { editGateVehicle } from './editGateVehicle.js';

const kinds = [['apartment','Квартиры'],['parking_space','Машиноместа'],['commercial','Коммерческие помещения']];
const csvCell = (v) => `"${String(v ?? '').replaceAll('"','""')}"`;
const objectType = (kind) => kind === 'parking_space' ? 'Машиноместо' : kind === 'commercial' ? 'Коммерческое помещение' : 'Квартира';
const numberCompare = (a,b) => String(a.number).localeCompare(String(b.number), 'ru', {numeric:true,sensitivity:'base'});
const parkingLevel = (floor) => Number(floor)<0 ? Number(floor) : -Number(floor);

export async function gateAccessViewPage(container) {
  let buildings = [];
  let premises = [];
  let activeByPremises = new Map();
  const ownersByPremises = new Map();
  const today = todayIso();
  let selected = null;
  let showRejected = false;
  const type = el('select', { 'aria-label':'Тип объекта' }, kinds.map(([value,label]) => el('option',{value},label)));
  const building = el('select', { 'aria-label':'Дом' }, [el('option',{value:''},'Загрузка домов…')]);
  const grid = el('div',{class:'gate-access-grid',role:'list','aria-label':'Объекты по этажам'});
  const detail = el('section',{class:'gate-access-detail','aria-live':'polite'},el('p',{class:'muted'},'Выберите помещение на схеме'));
  const download = el('button',{class:'btn',type:'button',onclick:exportAll},'Скачать список доступов (CSV)');
  const lookupPhone = el('input',{type:'tel',inputmode:'tel',autocomplete:'tel',placeholder:'+7 900 000-00-00','aria-label':'Телефон для поиска'});
  bindGatePhoneInput(lookupPhone);
  const lookupResults = el('div',{class:'gate-phone-lookup-results','aria-live':'polite'});
  const lookupForm = el('form',{class:'gate-phone-lookup',onsubmit:searchPhone},[
    lookupPhone,
    el('button',{type:'submit',class:'btn btn-primary'},'Найти доступы'),
    el('span',{class:'field-help'},'Поиск по активным доступам и заявкам в данных Dom; устройства ELDES напрямую не опрашиваются.'),
    lookupResults,
  ]);
  const note = el('p',{class:'field-help'},'Зелёная ячейка означает, что у объекта есть действующий доступ. Коммерческие помещения дают доступ во двор.');
  const syncProgress=el('div',{class:'service-access-progress',hidden:true,role:'status','aria-live':'polite'},el('div',{class:'service-access-progress-card'},[
    el('span',{class:'service-access-spinner','aria-hidden':'true'}),el('span',{},'Обновляем доступ на устройствах…'),
  ]));
  container.replaceChildren(el('div',{class:'page'},[
    el('h1',{},'Доступы'), note,
    lookupForm,
    el('div',{class:'gate-filters gate-access-filters'},[type,building,download]),
    el('div',{class:'gate-access-layout'},[grid,detail]),
  ]),syncProgress);
  type.addEventListener('change',loadPremises);
  building.addEventListener('change',loadPremises);

  async function searchPhone(event) {
    event.preventDefault();
    lookupResults.replaceChildren(el('p',{class:'muted'},'Ищем…'));
    try {
      const {items=[]}=await gateApi.lookupPhone(lookupPhone.value);
      if(!items.length) {
        lookupResults.replaceChildren(el('p',{class:'muted'},'По этому номеру не найдено активных доступов или заявок на согласовании.'));
        return;
      }
      const statusLabel=(item)=>({
        approved:'Активен',active:'Активен',
        revoke_requested:'Ожидает отзыва администратором',revoke_pending:'Удаление с устройства не подтверждено',
        pending:'Заявка на согласовании',
      }[item.status]||item.status);
      const deviceLabel=(item)=>item.status==='revoke_requested'||item.status==='revoke_pending'?'Возможно, ещё есть на устройстве':item.on_device?'Есть':'Ещё не выдан';
      lookupResults.replaceChildren(el('p',{class:'field-help'},`Найдено оснований: ${items.length}`),el('div',{class:'data-table-wrap'},el('table',{class:'data-table'},[
        el('thead',{},el('tr',{},['Зона','Основание','Кому','Статус в Dom','Устройство'].map((label)=>el('th',{},label)))),
        el('tbody',{},items.map((item)=>el('tr',{},[
          el('td',{},item.zone==='parking'?'Паркинг':'Двор'),
          el('td',{},item.source==='service'?'Служебный доступ':el('button',{type:'button',class:'gate-phone-lookup-link',onclick:()=>openLookupPremise(item)},item.location)),
          el('td',{},item.name||'—'),
          el('td',{},[statusLabel(item),item.sync_error?el('div',{class:'form-error'},item.sync_error):null].filter(Boolean)),
          el('td',{},deviceLabel(item)),
        ]))),
      ])));
    } catch(error) {
      lookupResults.replaceChildren(el('p',{class:'form-error'},describeApiError(error).message));
    }
  }

  async function openLookupPremise(item) {
    if(!item.premises_id||!item.building_id) return;
    if(!buildings.some((b)=>b.id===item.building_id)) {
      toast.error('Дом для этого помещения не найден в списке');
      return;
    }
    type.value=item.premises_kind;
    building.value=String(item.building_id);
    await loadPremises();
    const premise=premises.find((p)=>p.id===item.premises_id);
    if(!premise) {
      toast.error('Помещение больше не отображается в схеме доступов');
      return;
    }
    selectPremises(premise);
    grid.querySelector(`[data-premises-id="${item.premises_id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  try {
    let offset=0;
    while(true) {
      const {items=[]}=await buildingsApi.list({limit:200,offset});
      buildings.push(...items);
      if(items.length<200) break;
      offset+=200;
    }
    building.replaceChildren(...buildings.map((b)=>el('option',{value:b.id},b.address || `Дом ${b.id}`)));
    if (buildings.length) await loadPremises();
    else grid.replaceChildren(el('p',{class:'muted'},'Дома не найдены'));
  } catch(e) { grid.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }

  async function loadPremises() {
    selected=null;
    detail.replaceChildren(el('p',{class:'muted'},'Выберите помещение на схеме'));
    grid.replaceChildren(el('p',{role:'status'},'Загрузка объектов…'));
    try {
      const {items=[]}=await premisesApi.list({kind:type.value,building_id:building.value,limit:200,offset:0});
      premises=items.filter((p)=>!p.deleted_at).sort(numberCompare);
      if (!premises.length) { grid.replaceChildren(el('p',{class:'muted'},'В этом доме нет объектов выбранного типа')); return; }
      await loadActiveAccesses();
      renderGrid();
    } catch(e) { grid.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }
  }

  async function loadActiveAccesses() {
    activeByPremises=new Map();
    let offset=0;
    while(true) {
      const {items=[]}=await gateApi.list({status:'approved',limit:200,offset});
      for(const row of items) if(row.active) {
        if(!activeByPremises.has(row.premises_id)) activeByPremises.set(row.premises_id,[]);
        activeByPremises.get(row.premises_id).push(row);
      }
      if(groupGateRequests(items).length<200) break;
      offset+=200;
    }
  }

  async function loadRejectedAccesses(premise) {
    const rows=[];
    let offset=0;
    while(true) {
      const {items=[]}=await gateApi.list({premises_id:premise.id,display_status:'rejected',limit:200,offset});
      rows.push(...items.filter((row)=>row.premises_id===premise.id));
      if(groupGateRequests(items).length<200) break;
      offset+=200;
    }
    return rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
  }

  function renderGrid() {
    const floors=new Map();
    for(const p of premises) {
      const key=p.floor == null ? 'unknown' : String(p.floor);
      if(!floors.has(key)) floors.set(key,[]);
      floors.get(key).push(p);
    }
    const floorOrder=(a,b)=>a==='unknown'?1:b==='unknown'?-1:type.value==='parking_space'?parkingLevel(b)-parkingLevel(a):Number(b)-Number(a);
    const groups=[...floors].sort(([a],[b])=>floorOrder(a,b));
    grid.replaceChildren(...groups.map(([floor,items])=>el('section',{class:'gate-floor'},[
          el('h2',{},floor==='unknown'?'—':type.value==='parking_space'?parkingLevel(floor):floor),
      el('div',{class:'gate-floor-cells'},items.map((p)=>{
        const accesses=activeByPremises.get(p.id)||[];
        const count=accesses.length;
        const tone=gatePremisesTone(accesses);
        return el('button',{type:'button',class:`gate-property-tile${tone==='tenant'?' has-tenant-access':tone==='access'?' has-access':''}${selected?.id===p.id?' is-selected':''}`,'data-premises-id':String(p.id),'aria-pressed':String(selected?.id===p.id),'aria-label':`${objectType(p.kind)} ${p.number}${count?`, действующих доступов: ${count}${tone==='tenant'?', есть арендатор':''}`:', доступов нет'}`,onclick:()=>selectPremises(p)},[
          el('strong',{},p.number),count?el('span',{class:'gate-property-count'},String(count)):null,
        ].filter(Boolean));
      })),
    ])));
  }

  function selectPremises(p) {
    selected=p;
    renderGrid();
    const entries=gateOwnersFirst(activeByPremises.get(p.id)||[]);
    const ownerLine=el('p',{class:'muted'},'Собственник: загружается…');
    const rejectedToggle=el('input',{type:'checkbox',checked:showRejected});
    const rejectedHost=el('div',{class:'gate-rejected-accesses',hidden:!showRejected});
    rejectedToggle.addEventListener('change',async()=>{
      showRejected=rejectedToggle.checked;
      rejectedHost.hidden=!showRejected;
      rejectedHost.replaceChildren();
      if(showRejected) await renderRejectedAccesses(p,rejectedHost);
    });
    detail.replaceChildren(
      el('h2',{},`${objectType(p.kind)} ${p.number}`),
      el('p',{class:'muted'},`Этаж ${p.floor ?? 'не указан'} · ${entries.length} ${entries.length===1?'доступ':entries.length>1&&entries.length<5?'доступа':'доступов'}`),
      ownerLine,
      el('button',{type:'button',class:'btn btn-primary',onclick:()=>createAccess(p)},'Добавить доступ'),
      renderTable({columns:[
        {key:'recipient_name',label:'Кому',primary:true},
        {key:'relation',label:'Тип',render:(r)=>GATE_RELATIONS[r.relation]||'—'},
        {key:'phone',label:'Телефон',render:(r)=>copyPhoneCell(r.phone,formatPhone)},
        {key:'vehicle',label:'Автомобиль',render:(r)=>el('div',{},gateVehicles(r).flatMap((car)=>[el('span',{},gateVehicleLabel(car)),car.id?el('button',{type:'button',class:'btn btn-sm',onclick:()=>editGateVehicle(car,async()=>{await loadActiveAccesses();selectPremises(p);})},'Изменить авто'):null].filter(Boolean)))},
        {key:'zone',label:'Зона',render:gateZoneLabel},
        {key:'valid_until',label:'Действует до',render:(r)=>r.valid_until||'Без срока'},
      ],rows:entries,rowActions:(r)=>[
        el('button',{type:'button',class:'btn btn-sm',onclick:()=>editAccess(r,p)},'Изменить'),
        el('button',{type:'button',class:'btn btn-sm btn-danger',onclick:()=>closeAccess(r,p)},'Закрыть'),
      ],emptyMessage:'У этого объекта нет действующих доступов'}),
      el('label',{class:'gate-rejected-toggle'},[rejectedToggle,' Показать отклонённые доступы']),
      rejectedHost,
    );
    loadOwners(p,ownerLine);
    if(showRejected) renderRejectedAccesses(p,rejectedHost);
  }

  async function renderRejectedAccesses(premise,host) {
    host.hidden=false;
    host.replaceChildren(el('p',{role:'status',class:'muted'},'Загрузка отклонённых доступов…'));
    try {
      const rows=await loadRejectedAccesses(premise);
      if(selected?.id!==premise.id||!showRejected||!host.isConnected)return;
      const statusLabel={rejected:'Отклонена',cancelled:'Отозвана заявителем',revoked:'Отозвана',expired:'Срок истёк',ineligible:'Право на объект утрачено'};
      host.replaceChildren(
        el('h3',{},'Отклонённые доступы'),
        rows.length?renderTable({columns:[
          {key:'recipient_name',label:'Кому',primary:true},
          {key:'relation',label:'Тип',render:(r)=>GATE_RELATIONS[r.relation]||'—'},
          {key:'phone',label:'Телефон',render:(r)=>copyPhoneCell(r.phone,formatPhone)},
          {key:'vehicle',label:'Автомобиль',render:(r)=>gateVehicles(r).map(gateVehicleLabel).join(', ')||'—'},
          {key:'status',label:'Статус',render:(r)=>statusLabel[r.effective_status]||'Отклонена'},
          {key:'review_note',label:'Причина',render:(r)=>r.review_note||'—'},
        ],rows,rowActions:(r)=>[el('button',{type:'button',class:'btn btn-sm btn-danger',onclick:()=>deleteRejected(r,premise)},'Удалить')],emptyMessage:'Отклонённых доступов нет'}):el('p',{class:'muted'},'Отклонённых доступов нет.'),
      );
    } catch(error) {
      if(selected?.id===premise.id&&showRejected&&host.isConnected) host.replaceChildren(el('p',{class:'form-error'},describeApiError(error).message));
    }
  }

  async function deleteRejected(row,premise) {
    const confirmed=await confirmDialog({title:'Удалить отклонённый доступ',message:`Удалить заявку № ${row.id} целиком, включая все помещения группы и её историю? Это действие нельзя отменить.`,confirmLabel:'Удалить',danger:true});
    if(!confirmed)return;
    try {
      await gateApi.remove(row.id);
      toast.success('Заявка удалена.');
      await loadActiveAccesses();
      selectPremises(premise);
    } catch(error) { toast.error(describeApiError(error).message); }
  }

  async function loadOwners(p,line) {
    try {
      if(!ownersByPremises.has(p.id)) {
        ownersByPremises.set(p.id,premisesApi.ownerships(p.id).then(({items=[]})=>items
          .filter((owner)=>isActiveOn(owner.valid_from,owner.valid_to,today))
          .map((owner)=>owner.owner_name).filter(Boolean)));
      }
      const owners=await ownersByPremises.get(p.id);
      if(selected?.id!==p.id||!line.isConnected)return;
      line.textContent=`Собственник: ${owners.length?owners.join(', '):'не указан'}`;
    } catch {
      ownersByPremises.delete(p.id);
      if(selected?.id===p.id&&line.isConnected)line.textContent='Собственник: не удалось загрузить';
    }
  }

  function createAccess(premise) {
    const name=el('input',{required:true,maxlength:120});
    const phone=el('input',{required:true,type:'tel',inputmode:'numeric',autocomplete:'tel',maxlength:16,pattern:'\\+7 [0-9]{3} [0-9]{3} [0-9]{2} [0-9]{2}',placeholder:'+7 900 000 00 00'});
    bindGatePhoneInput(phone);
    const relation=el('select',{},Object.entries(GATE_RELATIONS).filter(([value])=>value!=='service').map(([value,label])=>el('option',{value,selected:value==='guest'},label)));
    const validUntil=el('input',{type:'date'});
    const noCar=el('input',{type:'checkbox'});
    const cars=el('div',{class:'gate-edit-cars'});
    const rows=[];
    const sync=()=>rows.forEach((car)=>{car.plate.disabled=noCar.checked;car.brand.disabled=noCar.checked;car.remove.disabled=noCar.checked;});
    const addCar=(vehicle={})=>{
      const plate=el('input',{maxlength:24,placeholder:'Номер автомобиля',value:vehicle.plate_number||''});
      const brand=el('input',{maxlength:80,placeholder:'Марка автомобиля',value:vehicle.brand||''});
      let line;
      const remove=el('button',{type:'button',class:'btn btn-sm',onclick:()=>{rows.splice(rows.indexOf(car),1);line.remove();sync();}},'Удалить');
      const car={plate,brand,remove};line=el('div',{class:'gate-edit-car'},[plate,brand,remove]);rows.push(car);cars.append(line);sync();
    };
    addCar();noCar.addEventListener('change',sync);
    const message=el('p',{role:'alert',class:'form-error'});
    const save=el('button',{type:'submit',class:'btn btn-primary'},'Добавить доступ');
    let modal;
    const form=el('form',{class:'form',onsubmit:async(event)=>{
      event.preventDefault();if(!form.reportValidity())return;save.disabled=true;syncProgress.hidden=false;
      try{
        await gateApi.create({premises_id:premise.id,zone:premise.kind==='parking_space'?'parking':'courtyard',phone:phone.value.trim(),recipient_name:name.value.trim(),relation:relation.value,valid_until:validUntil.value||null,no_personal_vehicle:noCar.checked,vehicles:noCar.checked?[]:rows.map(({plate,brand})=>({plate_number:plate.value.trim(),brand:brand.value.trim()})).filter((car)=>car.plate_number||car.brand)});
        modal.close();await loadActiveAccesses();selectPremises(premise);
      }catch(error){message.textContent=describeApiError(error).message;}finally{save.disabled=false;syncProgress.hidden=true;}
    }},[
      el('p',{class:'muted'},`${objectType(premise.kind)} ${premise.number}. Доступ будет активен сразу.`),
      el('label',{class:'field'},['Имя',name]),el('label',{class:'field'},['Телефон',phone]),
      el('label',{class:'field'},['Кто будет пользоваться',relation]),el('label',{class:'field'},['Действует до (необязательно)',validUntil]),
      el('fieldset',{class:'field'},[el('legend',{},'Автомобили'),cars,el('button',{type:'button',class:'btn btn-sm',onclick:()=>addCar()},'Добавить автомобиль'),el('label',{},[noCar,' Нет личного автомобиля'])]),message,save,
    ]);
    modal=openModal({title:'Добавить доступ без заявки',content:form,wide:true});
  }

  function closeAccess(row,premise) {
    const reason=el('textarea',{maxlength:500,rows:3,'aria-label':'Причина закрытия доступа'});
    const message=el('p',{role:'alert',class:'form-error'});
    const submit=el('button',{type:'submit',class:'btn btn-danger'},'Закрыть доступ');
    let modal;
    const form=el('form',{class:'form',onsubmit:async(event)=>{
      event.preventDefault();submit.disabled=true;
      try{
        await gateApi.decision(row.id,{action:'revoke',note:reason.value.trim()});
        modal.close();await loadActiveAccesses();selectPremises(premise);
      }catch(error){message.textContent=describeApiError(error).message;}finally{submit.disabled=false;}
    }},[
      el('p',{},`Закрыть доступ для ${row.recipient_name} (${formatPhone(row.phone)})?`),
      el('label',{class:'field'},['Причина',reason]),message,submit,
    ]);
    modal=openModal({title:'Закрыть доступ',content:form});
  }

  function editAccess(row, premise) {
    const name=el('input',{required:true,maxlength:120,value:row.recipient_name});
    const relation=el('select',{},Object.entries(GATE_RELATIONS).filter(([value])=>value!=='service').map(([value,label])=>el('option',{value,selected:row.relation===value||(row.relation==='service'&&value==='guest')},label)));
    const noCar=el('input',{type:'checkbox',checked:!!row.no_personal_vehicle});
    const cars=el('div',{class:'gate-edit-cars'});
    const rows=[];
    const sync=()=>rows.forEach((car)=>{car.plate.disabled=noCar.checked;car.brand.disabled=noCar.checked;car.remove.disabled=noCar.checked;});
    const addCar=(vehicle={})=>{
      const plate=el('input',{maxlength:24,placeholder:'Номер автомобиля',value:vehicle.plate_number||''});
      const brand=el('input',{maxlength:80,placeholder:'Марка автомобиля',value:vehicle.brand||''});
      let line;
      const remove=el('button',{type:'button',class:'btn btn-sm',onclick:()=>{rows.splice(rows.indexOf(car),1);line.remove();sync();}},'Удалить');
      const car={plate,brand,remove};
      line=el('div',{class:'gate-edit-car'},[plate,brand,remove]);
      rows.push(car);cars.append(line);sync();
    };
    for(const car of gateVehicles(row))addCar(car);
    if(!rows.length)addCar();
    noCar.addEventListener('change',sync);
    const message=el('p',{role:'alert',class:'form-error'});
    const save=el('button',{type:'submit',class:'btn btn-primary'},'Сохранить');
    let modal;
    const form=el('form',{class:'form',onsubmit:async(event)=>{
      event.preventDefault();if(!form.reportValidity())return;save.disabled=true;
      try{
        await gateApi.update(row.id,{recipient_name:name.value.trim(),relation:relation.value,no_personal_vehicle:noCar.checked,vehicles:noCar.checked?[]:rows.map(({plate,brand})=>({plate_number:plate.value.trim(),brand:brand.value.trim()})).filter((car)=>car.plate_number||car.brand)});
        modal.close();await loadActiveAccesses();selectPremises(premise);
      }catch(error){message.textContent=describeApiError(error).message;}finally{save.disabled=false;}
    }},[
      el('label',{class:'field'},['Имя',name]),
      el('label',{class:'field'},['Кто будет пользоваться',relation]),
      el('fieldset',{class:'field'},[el('legend',{},'Автомобили'),cars,el('button',{type:'button',class:'btn btn-sm',onclick:()=>addCar()},'Добавить автомобиль'),el('label',{},[noCar,' Нет личного автомобиля'])]),
      message,save,
    ]);
    modal=openModal({title:`Доступ · ${objectType(premise.kind)} ${premise.number}`,content:form,wide:true});
  }

  async function exportAll() {
    download.disabled=true;
    try {
      const all=[];
      for(const [kind] of kinds) {
        let offset=0;
        while(true) {
          const {items=[]}=await premisesApi.list({kind,limit:200,offset});
          all.push(...items.filter((x)=>!x.deleted_at));
          if(items.length<200) break;
          offset+=200;
        }
      }
      const grouped=[];
      const premiseByID=new Map(all.map((p)=>[p.id,p]));
      for(const p of all) {
        let offset=0;
        while(true) {
          const {items=[]}=await gateApi.list({premises_id:p.id,status:'approved',limit:200,offset});
          grouped.push(...items.filter((r)=>r.active&&r.premises_id===p.id));
          if(groupGateRequests(items).length<200) break;
          offset+=200;
        }
      }
      const rows=[['Тип объекта','Номер помещения','Дом','Этаж','Зона','Кому','Тип пользователя','Телефон','Автомобиль','Действует до']];
      for(const r of grouped) {
        const cars=gateVehicles(r);
        for(const car of cars.length?cars:[null]) rows.push([objectType(r.premises_kind),r.premises_number,r.address,premiseByID.get(r.premises_id)?.floor??'',gateZoneLabel(r),r.recipient_name,GATE_RELATIONS[r.relation]||'',formatPhone(r.phone),car?gateVehicleLabel(car):'',r.valid_until||'Без срока']);
      }
      const csv='\ufeff'+rows.map((r)=>r.map(csvCell).join(';')).join('\r\n');
      saveFile({blob:new Blob([csv],{type:'text/csv;charset=utf-8'}),fileName:'доступы-по-объектам.csv'});
    } catch(e) { detail.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }
    finally { download.disabled=false; }
  }
}
