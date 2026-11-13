"""Check atomic progress updates in a disposable local Docker PostgreSQL database.

Usage: python tools/check_review_concurrency.py CONTAINER
Apply the BioViz core and review migrations first. Never points at a remote database.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import sys

container = sys.argv[1]


def sql(query):
    return subprocess.run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres',
                           '-v', 'ON_ERROR_STOP=1', '-At'], input=query, text=True,
                          capture_output=True, check=True).stdout.strip()


sql("insert into bv_students(id,code,name) values ('review-race','REVIEW-RACE-ONLY','Test race');")
try:
    def write(n):
        data = json.dumps({'prog': {'seen': {'l01': ['s%02d' % n]},
                          'last': {'id': 'l01', 's': 's%02d' % n, 't': n}, 't': n}})
        sql("select bv_set('REVIEW-RACE-ONLY','students','review-race','" + data + "');")

    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(write, range(24)))
    data = json.loads(sql("select data from bv_docs where col='students' and id='review-race';"))
    assert data['prog']['seen']['l01'] == ['s%02d' % n for n in range(24)], data
    assert data['prog']['last']['s'] == 's23', data
    print('PASS: 24 simultaneous updates, including first insert, preserve every mark and newest position')
finally:
    sql("delete from bv_docs where col='students' and id='review-race'; delete from bv_students where id='review-race';")
