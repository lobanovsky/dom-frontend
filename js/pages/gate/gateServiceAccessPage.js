import { gateServiceAccessApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { formatPhone, formatDate } from '../../lib/format.js';
import { toast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { bindGatePhoneInput } from '../../lib/gate.js';

const zoneNames = {courtyard:'Двор',parking:'Паркинг'};
const zoneIcons = {courtyard:'🏠',parking:'🅿️'};
const categoryNames = {staff:'Сотрудник ТСН',contractor:'Подрядчик',special_vehicle:'Спецтехника'};
const statusNames = {active:'Активен',revoke_pending:'Ожидает удаления из ELDES',revoked:'Отозван',expired:'Срок истёк'};

export async function gateServiceAccessPage(container) {
  const form = el('form',{class:'card service-access-form'});
  const category=el('select',{},Object.entries(categoryNames).map(([value,label])=>el('option',{value},label)));
  const name=el('input',{required:true,maxlength:120,placeholder:'Например, электрик или трактор'});
  const phone=el('input',{required:true,inputmode:'numeric',autocomplete:'tel',placeholder:'+7 900 000-00-00'});
  bindGatePhoneInput(phone);
  const plate=el('input',{maxlength:24,placeholder:'Номер автомобиля'});
  const brand=el('input',{maxlength:80,placeholder:'Марка / модель'});
  const validUntil=el('input',{type:'date'});
  const comment=el('input',{maxlength:1000,placeholder:'Комментарий (необязательно)'});
  const courtyard=el('input',{type:'checkbox',checked:true});
  const parking=el('input',{type:'checkbox'});
  const save=el('button',{type:'submit',class:'btn btn-primary'},'Добавить доступ');
  const progress=el('div',{class:'service-access-progress',hidden:true,role:'status','aria-live':'polite'},el('div',{class:'service-access-progress-card'},[
    el('span',{class:'service-access-spinner','aria-hidden':'true'}),el('span',{},'Обновляем доступ на устройствах…'),
  ]));
  form.replaceChildren(
    el('h2',{},'Новый служебный доступ'),
    el('label',{},['Категория',category]),el('label',{},['Кому / описание',name]),el('label',{},['Телефон',phone]),
    el('label',{},['Автомобиль',plate]),el('label',{},['Марка',brand]),el('label',{},['Действует до (необязательно)',validUntil]),
    el('label',{},['Комментарий',comment]),el('fieldset',{},[el('legend',{},'Зоны доступа'),el('label',{},[courtyard,' Двор']),el('label',{},[parking,' Паркинг'])]),save,
  );
  const list=el('div',{class:'crud-table'},el('p',{class:'muted'},'Загрузка…'));
  container.replaceChildren(el('div',{class:'page'},[el('h1',{},'Служебные доступы'),el('p',{class:'muted'},'Доступы сотрудников ТСН, подрядчиков и спецтехники без привязки к квартире или машиноместу. При выборе обеих зон они закрываются независимо.'),form,el('h2',{},'Текущие и закрытые доступы'),list]),progress);
  form.addEventListener('submit',async(e)=>{
    e.preventDefault();save.disabled=true;progress.hidden=false;
    try {
      const digits=phone.value.replace(/\D/g,'');
      await gateServiceAccessApi.create({category:category.value,name:name.value,phone:digits,vehicle_plate:plate.value,vehicle_brand:brand.value,valid_until:validUntil.value||null,comment:comment.value,zones:[...(courtyard.checked?['courtyard']:[]),...(parking.checked?['parking']:[])]});
      toast.success('Служебный доступ сохранён; действующие зоны не дублируются');form.reset();courtyard.checked=true;await load();
    } catch(err){toast.error(describeApiError(err).message)} finally{save.disabled=false;progress.hidden=true}
  });
  await load();
  async function load(){
    try{
      const {items=[]}=await gateServiceAccessApi.list();
      if(!items.length){list.replaceChildren(el('p',{class:'muted'},'Записей пока нет'));return}
      list.replaceChildren(el('div',{class:'data-table-wrap'},el('table',{class:'data-table service-access-table'},[
        el('thead',{},el('tr',{},['Категория / описание','Телефон','Автомобиль','Зона','Статус','Действует до','Действие'].map(x=>el('th',{},x)))),
        el('tbody',{},items.flatMap(item=>item.zones.map(zone=>el('tr',{},[
          el('td',{},[el('strong',{},item.name),el('div',{class:'service-access-category'},categoryNames[item.category]||item.category),item.comment?el('small',{class:'muted'},item.comment):null].filter(Boolean)),
          el('td',{},formatPhone(item.phone)),
          el('td',{},[item.vehicle_plate,item.vehicle_brand].filter(Boolean).join(' · ')||'—'),
          el('td',{},el('span',{class:'service-access-zone-badge'},[el('span',{'aria-hidden':'true'},zoneIcons[zone.zone]||''),zoneNames[zone.zone]||zone.zone])),
          el('td',{},[statusNames[zone.status]||zone.status,zone.sync_error?el('div',{class:'form-error'},zone.sync_error):null].filter(Boolean)),
          el('td',{},item.valid_until?formatDate(item.valid_until):'Без срока'),
          el('td',{},zone.status==='active'?el('button',{class:'btn btn-small',type:'button',onclick:async()=>{
            if(!await confirmDialog({title:'Отозвать служебный доступ',message:`Закрыть доступ во зону «${zoneNames[zone.zone]}» для ${item.name}?`,confirmLabel:'Отозвать',danger:true}))return;
            progress.hidden=false;
            try{await gateServiceAccessApi.revoke(item.id,zone.zone);toast.success('Доступ закрыт');await load()}
            catch(err){toast.error(describeApiError(err).message);await load()}
            finally{progress.hidden=true}
          }},'Отозвать'):'—'),
        ])))),
      ])));
    }catch(err){list.replaceChildren(el('p',{class:'form-error'},describeApiError(err).message))}
  }
}
