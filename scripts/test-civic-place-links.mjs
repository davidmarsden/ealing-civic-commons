import assert from 'node:assert/strict';
import { inferPlaceLinks, itemLinksToPlace, withPlaceLinks } from '../netlify/lib/civic-place-links.mjs';

const explicit = { title: 'Petition to stop the Troubadour Theatre development in Walpole Park', summary: '', topics: [] };
assert.equal(itemLinksToPlace(explicit, 'places/walpole-park'), true);
assert.equal(inferPlaceLinks(explicit)[0]?.provenance, 'explicit-place-mention');

const contextual = { title: 'The View from W5: The Podcast', summary: 'This week: the Troubadour theatre proposal and the council decision.', topics: ['Council & democracy'] };
assert.equal(itemLinksToPlace(contextual, 'places/walpole-park'), true);
assert.equal(inferPlaceLinks(contextual)[0]?.provenance, 'inferred-place-candidate');

const unrelated = { title: 'New homes proposed in Southall', summary: 'Planning application submitted.', topics: ['Planning & development'] };
assert.equal(itemLinksToPlace(unrelated, 'places/walpole-park'), false);

const reviewed = withPlaceLinks({ ...contextual, placeLinks: [{ route:'places/walpole-park', label:'Walpole Park', relationship:'about_place', provenance:'reviewed-link' }] });
assert.equal(reviewed.placeLinks.length, 1);
assert.equal(reviewed.placeLinks[0].provenance, 'reviewed-link');

console.log('Civic place-link tests passed.');
