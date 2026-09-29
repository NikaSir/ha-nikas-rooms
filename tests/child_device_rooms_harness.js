const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let Panel;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../custom_components/nikas_rooms/frontend/nikas-rooms-panel.js'), 'utf8'), {
  HTMLElement: class {},
  customElements: { get() {}, define(name, ctor) { Panel = ctor; } },
});
function rooms({ childArea = null, entityArea = null, parent = true, disabled = false, hidden = false, labels = ['v_ekspluatatsii'], parentArea = 'kitchen' } = {}) {
  const panel = Object.create(Panel.prototype);
  const child = { id: 'child', parent_device_id: 'parent', area_id: childArea, labels, disabled_by: disabled ? 'user' : null };
  panel._registries = {
    areas: [{area_id: 'kitchen', name: 'Кухня'}, {area_id: 'garage', name: 'Гараж'}, {area_id: 'bedroom', name: 'Спальня'}],
    devices: [child, ...(parent ? [{id: 'parent', area_id: parentArea, labels: ['v_ekspluatatsii']}] : [])],
    entities: [{entity_id: 'sensor.child', device_id: 'child', area_id: entityArea, hidden_by: hidden ? 'user' : null}], labels: [],
  };
  const before = JSON.stringify(panel._registries);
  panel.buildRooms();
  assert.equal(JSON.stringify(panel._registries), before, 'HA registry records must not be mutated');
  return panel;
}
function hasEntity(panel, room) { return panel.room(room).entities.some(e => e.entity_id === 'sensor.child'); }
function hasDevice(panel, room) { return panel.room(room).devices.some(d => d.id === 'child'); }
const inherited = rooms();
assert.ok(hasEntity(inherited, 'kitchen'), 'child entity must inherit the parent room');
assert.ok(hasDevice(inherited, 'kitchen'), 'child device must inherit the parent room');
assert.ok(inherited.room('kitchen').summaryEntities.some(e => e.entity_id === 'sensor.child'));
assert.ok(inherited.room('kitchen').diagnosticDevices.some(d => d.id === 'child'));
const override = rooms({childArea: 'garage'});
assert.ok(hasEntity(override, 'garage'));
assert.ok(!hasEntity(override, 'kitchen'));
const entityOverride = rooms({childArea: 'garage', entityArea: 'bedroom'});
assert.ok(hasEntity(entityOverride, 'bedroom'));
assert.ok(hasDevice(entityOverride, 'bedroom'));
assert.ok(!hasEntity(entityOverride, 'garage'));
assert.ok(!hasEntity(rooms({parent: false}), 'kitchen'));
assert.ok(hasEntity(rooms({parent: false, childArea: 'garage'}), 'garage'));
assert.ok(!hasEntity(rooms({parentArea: null}), 'kitchen'));
assert.ok(!hasEntity(rooms({disabled: true}), 'kitchen'));
assert.ok(!hasDevice(rooms({disabled: true}), 'kitchen'));
assert.ok(!hasEntity(rooms({hidden: true}), 'kitchen'));
assert.ok(!hasEntity(rooms({labels: ['rezerv']}), 'kitchen'));
assert.ok(!hasEntity(rooms({labels: []}), 'kitchen'), 'parent labels are not inherited');
console.log('Child device room inheritance, overrides, and existing exclusions passed');
