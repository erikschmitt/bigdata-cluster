from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType
import mysqlx
import random
import math
import json

dbOptions = {"host": "my-app-mysql-service", 'port': 33060, "user": "root", "password": "mysecretpw"}
dbSchema = 'sentence'

# Example Part 1
# Create a spark session
spark = SparkSession.builder \
    .appName("Structured Streaming").getOrCreate()

# Set log level
spark.sparkContext.setLogLevel('ERROR')

# Example Part 2
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
    .add("n_serie", IntegerType()) \
    .add("n_season", IntegerType()) \
    .add("sentence", StringType()) \
#    .add("sentiment", StringType())

# Example Part 3
# Convert value: binary -> JSON -> fields + parsed timestamp
sentenceMessages = kafkaMessages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    from_json(
        column("value").cast("string"),
        sentenceMessageSchema
    ).alias("json")
).select(
    # Select all JSON fields
    column("json.*")
) \
    .withColumnRenamed('json.id', 'id') \
    .withColumnRenamed("json.person", "person") \
    .withColumnRenamed("json.n_serie", "n_serie") \
    .withColumnRenamed("json.n_season", "n_season") \
    .withColumnRenamed("json.sentence", "sentence")


# Example Part 4
# Compute most popular slides
# popular = trackingMessages.groupBy(
#     window(
#         column("parsed_timestamp"),
#         windowDuration,
#         slidingDuration
#     ),
#     column("mission")
# ).count().withColumnRenamed('count', 'views')

# Example Part 5
# Start running the query; print running counts to the console
consoleDump = sentenceMessages \
    .writeStream \
    .trigger(processingTime='1 minute') \
    .outputMode("append") \
    .format("console") \
    .option("truncate", "false") \
    .start()

# # Example Part 6

def sentimentGen():
    random_num = random.uniform(-2, 2)
    rnd_random_num = int(random_num * 100) / 100
    return rnd_random_num


def saveToDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mysql
    def save_to_db(iterator):
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        session.sql("USE sentence").execute()

        for row in iterator:
            # Run upsert (insert or update existing)
            sentiment_value = sentimentGen()
            print(sentiment_value)
            sentiment_group = ""

            print(type(row))
            print(type(row.id))
            print(row.id)
            print(type(row.person))
            print(row.person)
            print(type(row.n_serie))
            print(row.n_serie)
            print(type(row.n_season))
            print(row.n_season)
            print(type(row.sentence))
            print((row.sentence).encode('utf-8'))

            if -2 <= sentiment_value < -1:
                sentiment_group = "sentiment_group_n2"
            elif -1 <= sentiment_value < 0:
                sentiment_group = "sentiment_group_n1"
            elif 0 <= sentiment_value < 1:
                sentiment_group = "sentiment_group_p1"
            elif 1 <= sentiment_value < 2:
                sentiment_group = "sentiment_group_p2"

            print("sentiment_group " + sentiment_group)
            print("sentiment_value " + str(sentiment_value))

            sql = session.sql("INSERT INTO sentence "
                              "(id, person, n_serie, n_season, sentence, sentiment) VALUES (?, ?, ?, ?, ?, ?)")
            sql.bind(row.id,\
                    row.person,\
                    row.n_serie,\
                    row.n_season,\
                    (row.sentence).encode('utf-8'),\
                    sentiment_value).execute()

            sql = session.sql("CALL add_count(?, ?, ?)")
            sql.bind(row.person, \
                        row.n_season,\
                        sentiment_group).execute()

        session.close()

    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db)

# # Example Part 7


dbInsertStream = sentenceMessages.writeStream \
   .trigger(processingTime='1 minute') \
   .outputMode("update") \
   .foreachBatch(saveToDatabase) \
   .start()

# # Wait for termination
spark.streams.awaitAnyTermination()
