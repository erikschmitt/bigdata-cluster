from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType
import mysqlx
import random
import math
import json

dbOptions = {"host": "my-app-mysql-service", 'port': 33060, "user": "root", "password": "mysecretpw"}
dbSchema = 'sentence'

# Create a spark session
spark = SparkSession.builder \
    .appName("Structured Streaming").getOrCreate()

# Set log level to ERROR, because the WARN-Messages were too much
spark.sparkContext.setLogLevel('ERROR')

# Read messages from Kafka
kafkaMessages = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers",
            'my-cluster-kafka-bootstrap:9092') \
    .option("subscribe", "got_data") \
    .option("startingOffsets", "earliest") \
    .load()

print("###kafkaMessages.isStreaming " + str(kafkaMessages.isStreaming))
#pprint.pprint(kafkaMessages.value.value)

# Define schema of data
sentenceMessageSchema = StructType() \
    .add("id", IntegerType()) \
    .add("person", StringType()) \
    .add("season", IntegerType()) \
    .add("episode", IntegerType()) \
    .add("sentence", StringType()) \

# Convert value: binary -> JSON -> fields
sentenceMessages = kafkaMessages.select(
    # Extract 'value' from Kafka message, there are all columns in it
    from_json(
        column("value").cast("string"),
        sentenceMessageSchema
    ).alias("json")
).select(
    # Select all JSON fields and rename them correctly
    column("json.*")
) \
    .withColumnRenamed('json.id', 'id') \
    .withColumnRenamed("json.person", "person") \
    .withColumnRenamed("json.season", "season") \
    .withColumnRenamed("json.episode", "episode") \
    .withColumnRenamed("json.sentence", "sentence")

# Start running the query; print running counts to the console
consoleDump = sentenceMessages \
    .writeStream \
    .trigger(processingTime='1 minute') \
    .outputMode("append") \
    .format("console") \
    .option("truncate", "false") \
    .start()

# Generate our Sentiment-Dummy; round()-Function is not used because pyspark.sql also got a round()-Function and they don't like eachother
def sentimentGen():
    random_num = random.uniform(-2, 2)
    rnd_random_num = int(random_num * 100) / 100
    return rnd_random_num

# This function is to iterate over one Batch

def saveToDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mysql
    def save_to_db(iterator):
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        session.sql("USE sentence").execute()

        # Iterates over the rows of this Batch
        for row in iterator:
            # Get the sentiment_value
            sentiment_value = sentimentGen()
            sentiment_group = ""
            # Define the sentiment_group by the sentiment_value
            if -2 <= sentiment_value < -1:
                sentiment_group = "sentiment_group_n2"
            elif -1 <= sentiment_value < 0:
                sentiment_group = "sentiment_group_n1"
            elif 0 <= sentiment_value < 1:
                sentiment_group = "sentiment_group_p1"
            elif 1 <= sentiment_value < 2:
                sentiment_group = "sentiment_group_p2"

            # For the table "sentence" the relevant characteristics of the sentence will be inserted
            sql = session.sql("INSERT INTO sentence (id, person, season, episode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id")
            sql.bind(row.id,\
                    row.person,\
                    row.season,\
                    row.episode).execute()
            # For the table "sentiment_counts" the adding up of the counts will be triggered by this procedure-call
            sql = session.sql("CALL add_count(?, ?, ?)")
            sql.bind(row.person, \
                        row.season,\
                        sentiment_group).execute()

        session.close()
    # quick indicator in log for successfull data processing of one dataset
    print("Dataframe processed")

    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db)

# Write data to database
dbInsertStream = sentenceMessages.writeStream \
   .trigger(processingTime='1 minute') \
   .outputMode("update") \
   .foreachBatch(saveToDatabase) \
   .start()

# Wait for termination
spark.streams.awaitAnyTermination()
