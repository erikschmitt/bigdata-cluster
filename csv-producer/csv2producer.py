from time import sleep
import json
from kafka import KafkaProducer
from random import random
import csv
import os
import sys

kafka_broker = 'my-cluster-kafka-bootstrap:9092'
kafka_topic = "got-data"
counter = 0

kp = KafkaProducer(
    bootstrap_servers=kafka_broker,
    value_serializer=lambda x: 
    json.dumps(x).encode('utf-8'))

if kp.bootstrap_connected():
    print("Kafka connected")

# def randomClientId():
#     return "tracker" + str(round(random() * 100000))

# Define producer with broker, client_id and value_serializer
# Added Exception-Handling
# Maybe add batching????

# def getProducer():
#     kafka_producer = KafkaProducer(bootstrap_servers = kafka_broker,
#                                   client_id = randomClientId(),
#                                   value_serializer = lambda x :
#                                   dumps(x).encode("utf-8"),
#                                   api_version=(0, 10, 1))
#     return kafka_producer

# def getProducers():
#     kafka_producer = None
#     try:
#         kafka_producer = KafkaProducer(bootstrap_servers=kafka_broker,
#                                        client_id = randomClientId(),
#                                        value_serializer = lambda x : dumps(x).encode("utf-8"),
#                                        retries=10,
#                                        api_version=(0, 10, 1))
#     except Exception as ex:
#         console.log("Kafka-Connection failed")
#         console.log(str(ex))
#     finally:
#         return kafka_producer
    
# read in csv-File

with open(os.path.join(sys.path[0], "got_scripts_breakdown.csv"), "r", encoding="utf8") as file:
    for line in file:
        if counter > 0:
            lines = line.split(";")
            data = {'id' : lines[0],
                    'person' : lines[4],
                    'n_serie' : lines[5],
                    'n_season' : lines[6],
                    'sentence' : lines[3]}
            data_json = json.dumps(data)
            print(f"Sending message: {data_json}")
            future = kp.send(kafka_topic, data_json)
            result = future.get(timeout=5)
            print(f"Result: {result}")
            if ((counter > 1) & (counter % 100 == 0)):
                sleep(5)
            kp.flush()

        counter += 1
    
if kp is not None:
    kp.close()
