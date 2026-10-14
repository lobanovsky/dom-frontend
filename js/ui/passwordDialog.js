import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { createForm } from './form.js';
import { toast } from './toast.js';
import { applyFormApiError } from '../lib/apiErrors.js';
import { changePassword } from '../api/auth.js';

const fields = [
  { type: 'password', name: 'current_password', label: 'Текущий пароль', required: true, full: true, autocomplete: 'current-password' },
  { type: 'password', name: 'new_password', label: 'Новый пароль', required: true, full: true, autocomplete: 'new-password', minLength: 8, maxLength: 72, help: 'Не короче 8 символов' },
  { type: 'password', name: 'repeat', label: 'Новый пароль ещё раз', required: true, full: true, autocomplete: 'new-password' },
];

// Смена собственного пароля (любая роль). Прочие входы с этим логином завершаются, текущий остаётся.
export function openPasswordDialog() {
  let modal;
  const form = createForm({
    fields,
    submitLabel: 'Сменить пароль',
    onCancel: () => modal.close(),
    onSubmit: async (values) => {
      if (values.new_password !== values.repeat) {
        form.setFieldErrors({ repeat: 'Пароли не совпадают' });
        return;
      }
      try {
        await changePassword(values.current_password ?? '', values.new_password);
        modal.close();
        toast.success('Пароль изменён');
      } catch (err) {
        applyFormApiError(form, err);
      }
    },
  });
  modal = openModal({ title: 'Смена пароля', content: el('div', { class: 'entity-form-wrap' }, form.element) });
  return modal;
}
