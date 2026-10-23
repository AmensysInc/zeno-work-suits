import { Input } from 'antd';
import { useSave } from '../../hooks/data';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
import { Select, labelled } from '../ui/form';
import { roles } from '../../types';

export default function AddPersonModal({ onClose }: { onClose: () => void }) {
  const save = useSave('/auth/users', 'post', 'Person added');
  return (
    <Modal open title="Add person" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save.mutateAsync(
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        <div className="form-grid">
          <Field label="First name">
            <Input name="first_name" required maxLength={80} />
          </Field>
          <Field label="Last name">
            <Input name="last_name" required maxLength={80} />
          </Field>
        </div>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
        <div className="form-grid">
          <Field label="Starting password · at least 8 characters">
            <Input.Password
              name="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Role">
            <Select
              name="role"
              defaultValue="EMPLOYEE"
              options={labelled(roles)}
            />
          </Field>
        </div>
        <p className="muted">
          Share the email and starting password with them so they can sign in.
        </p>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Add person
          </Button>
        </div>
      </form>
    </Modal>
  );
}
