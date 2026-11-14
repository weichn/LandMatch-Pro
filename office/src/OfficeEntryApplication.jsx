import OfficeApp from './OfficeApp';

export default function OfficeEntryApplication({returnTo}){
 // Keep the Office shell mounted for every entry point, including /?import=1.
 return <OfficeApp initialTab={returnTo==='import'?'import':'office_cases'}/>;
}
