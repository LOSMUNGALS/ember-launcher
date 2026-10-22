import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalog,quality as serverQuality} from '../desktop/catalog';
import {quality} from '../src/recommendations';
import {initialState} from '../desktop/state';
test('adult metadata retains artwork, trailer, description and screenshots through the ordinary catalog pipeline',()=>{
 const media='https://shared.akamai.steamstatic.com/fixture';
 const raw={'10':{success:true,data:{steam_appid:10,type:'game',name:'Mature fixture',content_descriptors:{ids:[3]},platforms:{windows:true},header_image:media+'.jpg',about_the_game:'<p>Fixture description.</p>',screenshots:[{path_full:media+'-screen.jpg'}],movies:[{mp4:{max:media+'.mp4'}}],release_date:{coming_soon:false,date:'2026'}}}};
 const game=parseCatalog('10',raw,null),prefs=initialState().preferences;
 assert.equal(game.content,'explicit');assert.equal(serverQuality(game,prefs),true);assert.equal(quality(game,prefs),true);
 assert.ok(game.cover);assert.match(game.description,/Fixture description/);assert.equal(game.screenshots.length,1);assert.equal(game.trailers?.length,1);
 game.content='uncertain';assert.equal(serverQuality(game,prefs),true);assert.equal(quality(game,prefs),true);
});
