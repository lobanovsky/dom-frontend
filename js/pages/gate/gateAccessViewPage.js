import { gateApi, premisesApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatPhone } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { renderTable } from '../../ui/table.js';
import { saveFile } from '../../ui/saveFile.js';
import { gatePropertyLabel, gateVehicles, gateVehicleLabel, gateZoneLabel } from '../../lib/gate.js';

const kinds = [['apartment','Квартира'],['commercial','Коммерческое помещение'],['parking_space','Машиноместо']];
const csvCell = (v) => `"${String(v ?? '').replaceAll('"','""')}"`;

export async function gateAccessViewPage(container) {
  let objects = [];
  const type = el('select', { 'aria-label':'Тип объекта' }, kinds.map(([value,label]) => el('option',{value},label)));
  const property = el('select', { 'aria-label':'Помещение' }, [el('option',{value:''},'Загрузка помещений…')]);
  const host = el('div', { class:'crud-table' });
  const download = el('button',{class:'btn',type:'button',onclick:exportAll},'Скачать доступы по всем объектам (CSV)');
  const note = el('p',{class:'field-help'},'Здесь показаны только действующие доступы. Коммерческие помещения дают доступ во двор.');
  container.replaceChildren(el('div',{class:'page'},[
    el('h1',{},'Просмотр доступов'), note,
    el('div',{class:'gate-filters'},[type,property,download]),
    host,
  ]));
  type.addEventListener('change', loadProperties);
  property.addEventListener('change', loadAccess);
  await loadProperties();

  async function loadProperties() {
    host.replaceChildren(el('p',{role:'status'},'Загрузка помещений…'));
    property.replaceChildren(el('option',{value:''},'Выберите помещение'));
    try {
      const {items=[]} = await premisesApi.list({kind:type.value,limit:200,offset:0});
      objects = items.filter((x)=>!x.deleted_at);
      for (const o of objects) property.append(el('option',{value:o.id},`${o.number} · ${o.kind==='parking_space'?'Машиноместо':o.kind==='commercial'?'Коммерческое помещение':'Квартира'} · дом ${o.building_id}`));
      if (!objects.length) host.replaceChildren(el('p',{class:'muted'},'Помещений этого типа нет'));
      else host.replaceChildren(el('p',{class:'muted'},'Выберите помещение, чтобы посмотреть доступы'));
    } catch(e) { host.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }
  }
  async function loadAccess() {
    if (!property.value) return;
    host.replaceChildren(el('p',{role:'status'},'Загрузка доступов…'));
    try {
      const {items=[]} = await gateApi.list({premises_id:property.value,status:'approved',limit:200,offset:0});
      const rows = items.filter((r)=>r.active && String(r.premises_id)===property.value);
      host.replaceChildren(renderTable({columns:[
        {key:'recipient_name',label:'Кому',primary:true},
        {key:'phone',label:'Телефон',render:(r)=>formatPhone(r.phone)},
        {key:'premises_number',label:'Объект',render:(r)=>gatePropertyLabel(r)},
        {key:'vehicle',label:'Автомобиль',render:(r)=>gateVehicles(r).filter((v)=>v.active!==false).map(gateVehicleLabel).join(', ')||'—'},
        {key:'zone',label:'Куда',render:(r)=>gateZoneLabel(r)},
        {key:'valid_until',label:'Действует',render:(r)=>r.valid_until||'Без срока'},
      ],rows,emptyMessage:'Действующих доступов нет'}));
    } catch(e) { host.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }
  }
  async function exportAll() {
    download.disabled=true;
    try {
      const all=[];
      for (const [kind] of kinds) {
        let offset=0;
        while (true) {
          const {items=[]}=await premisesApi.list({kind,limit:200,offset});
          all.push(...items.filter((x)=>!x.deleted_at));
          if(items.length<200) break;
          offset+=200;
        }
      }
      const grouped=[];
      for(const p of all) {
        let offset=0;
        while(true) {
          const {items=[]}=await gateApi.list({premises_id:p.id,status:'approved',limit:200,offset});
          grouped.push(...items.filter((r)=>r.active && r.premises_id===p.id));
          if(items.length<200) break;
          offset+=200;
        }
      }
      const rows=[['Тип объекта','Номер помещения','Дом','Зона','Кому','Телефон','Автомобиль','Действует до']];
      for(const r of grouped) for(const car of (gateVehicles(r).filter((v)=>v.active!==false).length?gateVehicles(r).filter((v)=>v.active!==false):[null])) rows.push([
        r.premises_kind==='parking_space'?'Машиноместо':r.premises_kind==='commercial'?'Коммерческое помещение':'Квартира',r.premises_number,r.address,gateZoneLabel(r),r.recipient_name,formatPhone(r.phone),car?gateVehicleLabel(car):'',r.valid_until||'Без срока']);
      const csv='\ufeff'+rows.map((r)=>r.map(csvCell).join(';')).join('\r\n');
      saveFile({blob:new Blob([csv],{type:'text/csv;charset=utf-8'}),fileName:'доступы-по-объектам.csv'});
    } catch(e) { host.replaceChildren(el('p',{class:'form-error'},describeApiError(e).message)); }
    finally { download.disabled=false; }
  }
}
