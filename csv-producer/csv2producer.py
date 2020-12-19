from time import sleep
from json import dumps
from kafka import KafkaProducer
from random import random
import csv
import os
import sys

dbOptions = {"host": "my-app-mysql-service", 'port': 33060, "user": "root", "password": "mysecretpw"}
kafka_broker = "my-cluster-kafka-bootstrap:9092"
kafka_topic = "got-data"
counter = 0

# pip install kafka-python --> Where to write to?

def randomClientId():
    return "tracker" + str(round(random() * 100000))

# Define producer with broker, client_id and value_serializer
# Added Exception-Handling
# Maybe add batching????

def getProducer():
    kafka_producer = KafkaProducer(bootstrap_servers = [kafka_broker],
                                  client_id = randomClientId(),
                                  value_serializer = lambda x :
                                  dumps(x).encode("utf-8"),
                                  retries=10,
                                  api_version=(0, 10, 1))
    return kafka_producer

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

def send_message(producer, data):
    while not producer.bootstrap_connected():
        sleep(1)

    producer.send(kafka_topic, value=data)
    # console.log("Sent to producer")
    # except Exception as ex:
    #     console.log("Failed to send to producer")
    #     print(str(ex))
    
# read in csv-File

with open(os.path.join(sys.path[0], "test.csv"), "r", encoding="utf8") as file:
    producer = getProducer()
    for line in file:
        if counter > 0:
            lines = line.split(";")
            data = {'id' : lines[0],
                    'person' : lines[4],
                    'n_serie' : lines[5],
                    'n_season' : lines[6],
                    'sentence' : lines[3]}
            send_message(producer, data)

            if ((counter > 1) & (counter % 20 == 0)):
                sleep(5)

        counter += 1
    
#    if producer is not None:
#        producer.close()
