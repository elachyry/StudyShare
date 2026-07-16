import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UploadCloud, Check } from 'lucide-react';
import type { ResourceType } from '@studyshare/shared';
import { filesApi, resourcesApi } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.js';
import { useBranches, useSubjects, localizedName } from '../../lib/hooks.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import { Button, Card, CardBody, Input, Select, Textarea, cn } from '../../components/ui/index.js';
import { formatBytes } from '../../lib/format.js';

const TYPES: ResourceType[] = ['LESSON', 'SUMMARY', 'EXERCISE'];
const TOTAL_STEPS = 4;

export function UploadPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const apiError = useApiError();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState<ResourceType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const branches = useBranches();
  const subjects = useSubjects(branchId);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file || !type) throw new Error('incomplete');
      const uploaded = await filesApi.upload(file, setProgress);
      return resourcesApi.create({
        title,
        description: description || undefined,
        type,
        branchId,
        subjectId,
        fileId: uploaded.fileId,
      });
    },
    onSuccess: (resource) => {
      toast.success(t('upload.success'));
      navigate(`/resources/${resource.id}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (user && !user.emailVerified) {
    return (
      <Card>
        <CardBody className="text-center text-muted">{t('upload.mustVerify')}</CardBody>
      </Card>
    );
  }

  const canNext =
    (step === 1 && branchId) ||
    (step === 2 && subjectId) ||
    (step === 3 && type) ||
    step === 4;
  const canSubmit = title.trim().length >= 3 && !!file;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{t('upload.title')}</h1>
        <p className="mt-1 text-sm text-muted">
          {t('upload.step', { current: step, total: TOTAL_STEPS })}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i + 1 <= step ? 'bg-accent' : 'bg-surface-2',
            )}
          />
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {step === 1 && (
            <Select
              label={t('upload.chooseBranch')}
              placeholder={t('resources.branch')}
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSubjectId('');
              }}
              options={(branches.data ?? []).map((b) => ({
                value: b.id,
                label: localizedName(b, i18n.language),
              }))}
            />
          )}

          {step === 2 && (
            <Select
              label={t('upload.chooseSubject')}
              placeholder={t('resources.subject')}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              options={(subjects.data ?? []).map((s) => ({
                value: s.id,
                label: localizedName(s, i18n.language),
              }))}
            />
          )}

          {step === 3 && (
            <Select
              label={t('upload.chooseType')}
              placeholder={t('resources.type')}
              value={type}
              onChange={(e) => setType(e.target.value as ResourceType)}
              options={TYPES.map((ty) => ({ value: ty, label: t(`resources.types.${ty}`) }))}
            />
          )}

          {step === 4 && (
            <>
              <Input
                label={t('upload.resourceTitle')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                label={`${t('upload.description')} (${t('common.optional')})`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div>
                <span className="mb-1 block text-sm font-medium text-text">{t('upload.file')}</span>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-2/50 p-8 text-center transition-colors hover:border-accent"
                >
                  {file ? (
                    <>
                      <Check className="h-8 w-8 text-success" />
                      <span className="text-sm text-text">{file.name}</span>
                      <span className="text-xs text-muted">
                        {formatBytes(file.size, i18n.language)}
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-8 w-8 text-muted" />
                      <span className="text-sm text-text">{t('upload.dropFile')}</span>
                      <span className="text-xs text-muted">{t('upload.allowedTypes')}</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.zip"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {submit.isPending && progress > 0 && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              {t('common.previous')}
            </Button>
            {step < TOTAL_STEPS ? (
              <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                {t('common.next')}
              </Button>
            ) : (
              <Button disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()}>
                {t('common.submit')}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
