import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import type { Resource } from '@studyshare/shared';
import { Card, CardBody, Badge, StarRating } from '../../components/ui/index.js';
import { formatNumber } from '../../lib/format.js';

export function ResourceCard({ resource }: { resource: Resource }) {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/resources/${resource.id}`} className="group block">
      <Card className="h-full transition-all group-hover:border-accent group-hover:shadow-md">
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-lg bg-accent/10 p-2 text-accent">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <Badge tone="accent">{t(`resources.types.${resource.type}`)}</Badge>
          </div>
          <h3 className="line-clamp-2 font-semibold text-text group-hover:text-accent">
            {resource.title}
          </h3>
          {resource.description && (
            <p className="line-clamp-2 flex-1 text-sm text-muted">{resource.description}</p>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted">
            <span className="flex items-center gap-1">
              <StarRating value={resource.averageRating} readOnly size={14} />
              <span className="text-xs">
                ({formatNumber(resource.ratingsCount, i18n.language)})
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Download className="h-3.5 w-3.5" aria-hidden />
              {formatNumber(resource.downloadsCount, i18n.language)}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
