import React from 'react';
import {createRoot} from 'react-dom/client';
import SaleParties from '../src/SaleParties';
import '../src/office.css';
createRoot(document.getElementById('root')).render(<main style={{maxWidth:800,margin:'30px auto'}}><h1>買賣角色隔離測試</h1><SaleParties officeId="test-office" caseId="test-case" canWrite/></main>);
