from time import sleep
import json
from kafka import KafkaProducer
from random import random
import csv
import os
import sys

kafka_broker = 'my-cluster-kafka-bootstrap:9092'
kafka_topic = "got_data"
counter = 0

kp = KafkaProducer(
    bootstrap_servers=kafka_broker,
    value_serializer=lambda x: 
    json.dumps(x, separators=(',', ':')).encode('utf-8'))

if kp.bootstrap_connected():
    print("Kafka connected")

    
# read in csv-File

with open(os.path.join(sys.path[0], "got_scripts_breakdown.csv"), "r", encoding="utf-8") as file:
    for line in file:
        if counter > 0:
            lines = line.strip().split(";")
            data = {'id' : int(lines[0]),
                    'person' : str(lines[4]),
                    'n_serie' : int(lines[5]),
                    'n_season' : int(lines[6]),
                    'sentence' : str(lines[3])}
            future = kp.send(kafka_topic, data)
            result = future.get(timeout=5)
            print(f"Result: {result}")
            if ((counter > 1) & (counter % 5 == 0)):
                sleep(15)
            kp.flush()

        counter += 1
    
if kp is not None:
    kp.close()
