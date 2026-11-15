import test from 'node:test';import assert from 'node:assert/strict';
import {postStockMovement,findStockIntegrityIssues,summarizeOperations} from './stockDomain';
import {parseStockKilograms,readPendingStockMovement,readWorkshopInventoryItem,stockHistoryDateBounds} from './workshopStock';

test('Kho xưởng lọc trọn ngày cuối theo giờ Việt Nam', () => {
  const { start, end } = stockHistoryDateBounds('2026-11-14', '2026-11-15');
  assert.equal(start?.toISOString(), '2026-11-13T17:00:00.000Z');
  assert.equal(end?.toISOString(), '2026-11-15T17:00:00.000Z');
  assert.equal(stockHistoryDateBounds('', '2026-11-15').start, null);
  assert.equal(stockHistoryDateBounds('2026-11-14', '').end, null);
  assert.throws(() => stockHistoryDateBounds('2026-02-29', ''), /không hợp lệ/);
  assert.throws(() => stockHistoryDateBounds('2026-11-15', '2026-11-14'), /trước hoặc bằng/);
});

test('Kho xưởng chuyển kg sang gram chính xác và kiểm tra giới hạn', () => {
  assert.equal(parseStockKilograms('12,345'), 12345);
  assert.equal(parseStockKilograms('0.001'), 1);
  assert.equal(parseStockKilograms('0', { allowZero: true }), 0);
  for (const value of ['', '0', '-1', '1e3', '1.0001', '1,2.3', '1000000001']) {
    assert.throws(() => parseStockKilograms(value));
  }
});

test('Kho xưởng không sử dụng mặt hàng sai xưởng, sai đơn vị hoặc sai số tồn', () => {
  const record = { id: 'PET_01', workshopId: 'xuong_a', name: 'PET', stockGrams: 1300 };
  assert.equal(readWorkshopInventoryItem('PET_01', 'xuong_a', record)?.stockGrams, 1300);
  assert.equal(readWorkshopInventoryItem('PET_01', 'xuong_b', record), null);
  assert.equal(readWorkshopInventoryItem('PET_01', 'xuong_a', { ...record, unit: 'Cái' }), null);
  assert.equal(readWorkshopInventoryItem('PET_01', 'xuong_a', { ...record, stockGrams: -1 }), null);
});

test('Phiếu kho chờ giữ nguyên mã sau khi đọc lại và chỉ thuộc đúng xưởng', () => {
  const movement = { workshopId: 'xuong_a', movementId: 'KHO_01', itemId: 'PET_01', type: 'out',
    quantityGrams: 1250, sourceType: 'manual', sourceId: 'KHO_01', note: 'Xuất kho' };
  assert.deepEqual(readPendingStockMovement(JSON.stringify(movement), 'xuong_a'), movement);
  assert.equal(readPendingStockMovement(JSON.stringify(movement), 'xuong_b'), null);
  assert.equal(readPendingStockMovement(JSON.stringify({ ...movement, sourceId: 'OTHER' }), 'xuong_a'), null);
  assert.equal(readPendingStockMovement('{', 'xuong_a'), null);
});
import type {PlasticInventoryItem,WeighTicket,CashTransaction} from '../../types/factory';
const item={id:'i',code:'K1',stockWeightKg:50,inWeightKg:70,outWeightKg:20,unit:'kg',category:'Nhựa đã băm',plasticType:'PET',location:'A',name:'PET',updatedAt:'today'} as PlasticInventoryItem;
const x={id:'m1',itemId:'i',type:'out' as const,quantity:20,sourceType:'manual' as const,at:'today',note:'test'};
test('4D xuất kho giảm tồn và tăng số xuất',()=>{const p=postStockMovement(item,[],x);assert.equal(p.item.stockWeightKg,30);assert.equal(p.item.outWeightKg,40);});
test('4D chặn xuất vượt tồn',()=>assert.throws(()=>postStockMovement(item,[],{...x,quantity:60})));
test('4D chặn thao tác trùng',()=>{const m=postStockMovement(item,[],x).movement;assert.throws(()=>postStockMovement(item,[m],x));});
test('4D chặn cộng hai lần cho cùng nguồn',()=>{const first=postStockMovement(item,[],{...x,id:'a',sourceType:'weigh_ticket',sourceId:'TK-01'}).movement;assert.throws(()=>postStockMovement(item,[first],{...x,id:'b',sourceType:'weigh_ticket',sourceId:'TK-01'}));});
test('4D tổng hợp không tính chuyển quỹ thành thu chi',()=>{const tx=[{type:'income',amount:100,status:'active'},{type:'expense',amount:25,status:'active'},{type:'transfer',amount:1000,status:'active'}] as CashTransaction[];assert.equal(summarizeOperations([] as WeighTicket[],tx,[item]).difference,75);});
test('4D phát hiện tồn âm',()=>assert.ok(findStockIntegrityIssues([{...item,stockWeightKg:-5}],[]).length>0));
