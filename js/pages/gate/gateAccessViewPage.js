import { buildingsApi, gateApi, premisesApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatPhone } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { renderTable } from '../../ui/table.js';
import { saveFile } from '../../ui/saveFile.js';
import { gateVehicles, gateVehicleLabel, gateZoneLabel, groupGateRequests } from '../../lib/gate.js';

const kinds = [['apartment','Квартиры'],['parking_space','Машиноместа'],['commercial','Коммерческие помещения']];
const csvCell = (v) => `"${String(v ?? '').replaceAll('"','""')}"`;
const objectType = (kind) => kind === 'parking_space' ? 'Машиноместо' : kind === 'commercial' ? 'Коммерческое помещение' : 'Квартира';
const numberCompare = (a,b) => String(a.number).localeCompare(String(b.number), 'ru', {numeric:true,sensitivity:'base'});
const parkingLevel = (floor) => Number(floor)<0 ? Number(floor) : -Number(floor);

export async function gateAccessViewPage(container) {
  let buildings = [];
  let premises = [];
  let activeByPremises = new Map();
  let selected = null;
  const type = el('select', { 'aria-label':'Тип объекта' }, kinds.map(([value,label]) => el('option',{value},label)));
  const building = el('select', { 'aria-label':'Дом' }, [el('option',{value:''},'Загрузка домов…')]);
  const grid = el('div',{class:'gate-access-grid',role:'list','aria-label':'Объекты по этажам'});
  const detail = el('section',{class:'gate-access-detail','aria-live':'polite'},el('p',{class:'muted'},'Выберите помещение на схеме'));
  const download = el('button',{class:'btn',type:'button',onclick:exportAll},'Скачать список доступов (CSV)');
  const note = el('p',{class:'field-help'},'Зелёная ячейка означает, что у объекта есть действующий доступ. Коммерческие помещения дают доступ во двор.');
  container.replaceChildren(el('div',{class:'page'},[
    el('h1',{},'Доступы'), note,
    el('div',{class:'gate-filters gate-access-filters'},[type,building,download]),
    el('div',{class:'gate-access-layout'},[grid,detail]),
  ]));
  type.addEventListener('change',loadPremises);
  building.addEventListener('change',loadPremises);
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
          el('h2',{},floor==='unknown'?'Этаж не указан':type.value==='parking_space'?`Этаж ${parkingLevel(floor)}`:`Этаж ${floor}`),
      el('div',{class:'gate-floor-cells'},items.map((p)=>{
        const count=activeByPremises.get(p.id)?.length||0;
        return el('button',{type:'button',class:`gate-property-tile${count?' has-access':''}${selected?.id===p.id?' is-selected':''}`,'aria-pressed':String(selected?.id===p.id),'aria-label':`${objectType(p.kind)} ${p.number}${count?`, действующих доступов: ${count}`:', доступов нет'}`,onclick:()=>selectPremises(p)},[
          el('strong',{},p.number),count?el('span',{class:'gate-property-count'},String(count)):null,
        ].filter(Boolean));
      })),
    ])));
  }

  function selectPremises(p) {
    selected=p;
    renderGrid();
    const entries=activeByPremises.get(p.id)||[];
    detail.replaceChildren(
      el('h2',{},`${objectType(p.kind)} ${p.number}`),
      el('p',{class:'muted'},`Этаж ${p.floor ?? 'не указан'} · ${entries.length} ${entries.length===1?'доступ':entries.length>1&&entries.length<5?'доступа':'доступов'}`),
      renderTable({columns:[
        {key:'recipient_name',label:'Кому',primary:true},
        {key:'phone',label:'Телефон',render:(r)=>formatPhone(r.phone)},
        {key:'vehicle',label:'Автомобиль',render:(r)=>gateVehicles(r).map(gateVehicleLabel).join(', ')||'—'},
        {key:'zone',label:'Зона',render:gateZoneLabel},
        {key:'valid_until',label:'Действует до',render:(r)=>r.valid_until||'Без срока'},
      ],rows:entries,emptyMessage:'У этого объекта нет действующих доступов'}),
    );
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
      const rows=[['Тип объекта','Номер помещения','Дом','Этаж','Зона','Кому','Телефон','Автомобиль','Действует до']];
      for(const r of grouped) {
        const cars=gateVehicles(r);
        for(const car of cars.length?cars:[null]) rows.push([objectType(r.premises_kind),r.premises_number,r.address,premiseByID.get(r.premises_id)?.floor??'',gateZoneLabel(r),r.recipient_name,formatPhone(r.phone),car?gateVehicleLabel(car):'',r.valid_until||'Без срока']);
      }
      const csv='\ufeff'+rows.map((r)=>r.map(csvCell).join(';')).join('\r\n');
      saveFile({blob:new Blob([csv],{type:'text/csv;charset=utf-8'}),fileName:'доступы-по-объектам.csv'});
    } catch(e) { detail.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }
    finally { download.disabled=false; }
  }
}
