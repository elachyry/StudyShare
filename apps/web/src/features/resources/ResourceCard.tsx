import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import type { Resource } from '@studyshare/shared';
import { Card, CardBody, Badge, StarRating } from '../../components/ui/index.js';
import { formatNumber } from '../../lib/format.js';

export function ResourceCard({ resource }: { resource: Resource }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={`/resources/${resource.id}`}
      className="group block rounded-2xl focus-visible:outline-none"
    >
      <Card className="h-full shadow-sm transition-all duration-200 ease-out will-change-transform group-hover:-translate-y-1 group-hover:shadow-xl">
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-fg">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <Badge tone="accent">{t(`resources.types.${resource.type}`)}</Badge>
          </div>

          <h3 className="line-clamp-2 font-heading text-base font-bold leading-snug text-text transition-colors group-hover:text-accent">
            {resource.title}
          </h3>
          {resource.description && (
            <p className="line-clamp-2 flex-1 text-sm text-muted">{resource.description}</p>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <StarRating value={resource.averageRating} readOnly size={14} />
              <span className="text-xs">({formatNumber(resource.ratingsCount, i18n.language)})</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-medium">
              <Download className="h-3.5 w-3.5" aria-hidden />
              {formatNumber(resource.downloadsCount, i18n.language)}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
