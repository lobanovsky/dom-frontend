import { gateApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';

export function editGateVehicle(vehicle, refreshed) {
  if (!vehicle?.id) return;
  const plate = el('input', { required: true, maxlength: 24, value: vehicle.plate_number || '' });
  const brand = el('input', { maxlength: 80, value: vehicle.brand || '' });
  const message = el('p', { role: 'alert', class: 'form-error' });
  const save = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Сохранить');
  let modal;
  const form = el('form', { class: 'form', onsubmit: async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    save.disabled = true;
    try {
      await gateApi.updateVehicle(vehicle.id, { plate_number: plate.value.trim(), brand: brand.value.trim() });
      modal.close();
      toast.success('Автомобиль обновлён во всех связанных заявках.');
      await refreshed();
    } catch (error) { message.textContent = describeApiError(error).message; save.disabled = false; }
  } }, [el('label', { class: 'field' }, ['Государственный номер', plate]), el('label', { class: 'field' }, ['Марка автомобиля', brand]), message, save]);
  modal = openModal({ title: 'Автомобиль собственника', content: form });
  const remove = el('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
    const confirmed = await confirmDialog({ title: 'Удалить автомобиль из реестра', message: `Автомобиль ${vehicle.plate_number} будет удалён из реестра и связанных заявок.`, confirmLabel: 'Удалить', danger: true });
    if (!confirmed) return;
    remove.disabled = true;
    try { await gateApi.deleteVehicle(vehicle.id); modal.close(); toast.success('Автомобиль удалён из реестра.'); await refreshed(); }
    catch (error) { message.textContent = describeApiError(error).message; remove.disabled = false; }
  } }, 'Удалить автомобиль');
  form.append(remove);
}
