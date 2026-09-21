import importlib.util, io, pathlib, unittest, zipfile
spec=importlib.util.spec_from_file_location('transit',pathlib.Path(__file__).with_name('fetch-transit.py'))
transit=importlib.util.module_from_spec(spec);spec.loader.exec_module(transit)

class TransitTests(unittest.TestCase):
    def test_serving_lines_platforms_and_pass_through(self):
        memory=io.BytesIO()
        with zipfile.ZipFile(memory,'w') as z:
            z.writestr('stops.txt','stop_id,stop_name,stop_lat,stop_lon,location_type,stop_code\na,"Stop, East",60.17,24.95,0,H1\nb,Station,60.17,24.95,1,\nc,Unserved,60.17,24.95,0,\nd,Outside,61,25,0,\n')
            z.writestr('routes.txt','route_id,route_type,route_short_name,route_long_name\nr1,3,23,Bus\nr2,900,6,Tram\n')
            z.writestr('trips.txt','trip_id,route_id\nt1,r1\nt2,r2\nt3,r1\n')
            z.writestr('stop_times.txt','trip_id,stop_id,pickup_type,drop_off_type\nt1,a,0,0\nt1,a,0,0\nt2,a,1,0\nt3,b,0,0\nt3,c,1,1\nt3,d,0,0\n')
        memory.seek(0)
        with zipfile.ZipFile(memory) as z: stops=transit.prepare(z,[24.8,60.1,25,60.2])
        self.assertEqual(len(stops),1);self.assertEqual(stops[0]['name'],'Stop, East')
        self.assertEqual(stops[0]['lines'],['Bus 23','Tram 6']);self.assertEqual(stops[0]['type'],'transit')
    def test_extended_modes(self):
        self.assertEqual([transit.mode(x) for x in ['0','1','2','3','4','100','109','700','900','1000']],['tram','metro','train','bus','ferry','train','train','bus','tram','ferry'])
if __name__=='__main__': unittest.main()
