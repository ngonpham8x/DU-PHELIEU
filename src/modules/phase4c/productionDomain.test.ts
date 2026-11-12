import test from 'node:test';import assert from 'node:assert/strict';
import {verifyProductionBatch,completeMaintenance,newMaintenanceRecord,findDuplicateTicketCodes} from './productionDomain';
import type {WeighTicket} from '../../types/factory';
const sample={ticketType:'production_batch',ticketCode:'MB-001',grossKg:1000,netKg:850,outputKg:850,scrapKg:100,machineName:'MB1'} as WeighTicket;
test('4C cân bằng đầu vào-đầu ra',()=>{const r=verifyProductionBatch(sample);assert.equal(r.lossKg,50);assert.equal(r.recoveryPercent,85);assert.equal(r.passed,true);});
test('4C bắt sản lượng vượt đầu vào',()=>assert.equal(verifyProductionBatch({...sample,outputKg:990}).passed,false));
test('4C cảnh báo hao hụt lớn',()=>assert.ok(verifyProductionBatch({...sample,outputKg:650}).issues.some(x=>x.includes('Hao hụt'))));
test('4C tạo và hoàn thành bảo trì idempotent',()=>{const task=newMaintenanceRecord({id:'M-1',machineId:'MB-1',machineName:'Máy',kind:'Mài dao',plannedDate:'2026-11-20',status:'pending',notes:''},[]);const a=completeMaintenance([task],task.id,'2026-11-20');assert.equal(completeMaintenance(a,task.id,'2026-11-21')[0].completedAt,'2026-11-20');});
test('4C dò mã phiếu cân trùng',()=>assert.deepEqual(findDuplicateTicketCodes([sample,{...sample,id:'2'}]),['MB-001']));
