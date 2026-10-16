import { DocumentPage } from './DocumentPage';
export function ResumesPage({ location, userId }: { location: string; userId: number }) { return <DocumentPage type="RESUME" location={location} userId={userId} />; }
