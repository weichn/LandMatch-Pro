import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBirthDate,formatBirthDate} from './birthDate.js';
test('ROC conversion, full width, blanks and pre-ROC dates',()=>{
 assert.equal(parseBirthDate('80/05/21'),'1991-05-21');
 assert.equal(parseBirthDate('民國８９年２月２９日'),'2000-02-29');
 assert.equal(parseBirthDate('民前1/12/31'),'1911-12-31');
 assert.equal(parseBirthDate(''),null);
 for(const iso of ['1911-12-31','1912-01-01','2000-02-29'])assert.equal(parseBirthDate(formatBirthDate(iso)),iso);
});
test('reject impossible, future and ambiguous dates without rollover',()=>{
 for(const x of ['80/02/29','89/04/31','0/1/1','80/13/1','80/1/0','1991/5/21','民前1912/1/1'])assert.throws(()=>parseBirthDate(x,'2026-10-04'));
 assert.equal(parseBirthDate('115/10/04','2026-10-04'),'2026-10-04');
 assert.throws(()=>parseBirthDate('115/10/05','2026-10-04'));
});
