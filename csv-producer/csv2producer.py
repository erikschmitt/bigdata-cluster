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

# Build KafkaProducer with transforming data in value to Json-Dump and erase blank spaces
kp = KafkaProducer(
    bootstrap_servers=kafka_broker,
    value_serializer=lambda x: 
    json.dumps(x, separators=(',', ':')).encode('utf-8'))

# Quick-Info for succesful conncection
if kp.bootstrap_connected():
    print("Kafka connected")

    
# Read in the csv-File by first encoding to utf-8

with open(os.path.join(sys.path[0], "got_scripts_breakdown.csv"), "r", encoding="utf-8") as file:
    # Iterate through file
    for line in file:
        # Ignore the header
        if counter > 0:
            # Separate the lines by ";"
            lines = line.strip().split(";")
            # Save data to dictionary and cast them to there required Data-Type
            data = {'id' : int(lines[0]),
                    'person' : str(lines[4]),
                    'season' : int((lines[1]).replace('Season ', '')),
                    'episode' : int(lines[6]),
                    'sentence' : str(lines[3])}
            # Send the data to the got_data topic. Here the data will be tranformed to JSON-Dump
            future = kp.send(kafka_topic, data)
            result = future.get(timeout=5)
            # Every 100 rows, there is time for some 2 seconds break, so that the dashboard won't be changing all the time
            if ((counter > 1) & (counter % 100 == 0)):
                sleep(2)
            # Flush the data of the Producer
            kp.flush()
        # Increase the counter for the sleep-check above
        counter += 1
# Let the producer close, when the file is read    
if kp is not None:
    kp.close()
