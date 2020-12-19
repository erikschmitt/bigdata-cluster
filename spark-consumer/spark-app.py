from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType
import mysqlx
#import sparknlp

dbOptions = {"host": "my-app-mysql-service", 'port': 33060, "user": "root", "password": "mysecretpw"}
dbSchema = 'popular'

# Example Part 1
# Create a spark session
spark = SparkSession.builder \
    .appName("Structured Streaming").getOrCreate()

# Set log level
spark.sparkContext.setLogLevel('WARN')

# Example Part 2
# Read messages from Kafka
kafkaMessages = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers",
            "my-cluster-kafka-bootstrap:9092") \
    .option("subscribe", "got-data") \
    .option("startingOffsets", "earliest") \
    .load()

# Define schema of tracking data
trackingMessageSchema = StructType() \
    .add("id", IntegerType()) \
    .add("person", StringType()) \
    .add("n_serie", IntegerType()) \
    .add("n_season", IntegerType()) \
    .add("sentence", StringType())

# Example Part 3
# Convert value: binary -> JSON -> fields + parsed timestamp
sentenceMessages = kafkaMessages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    from_json(
        column("value").cast("string"),
        trackingMessageSchema
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
# consoleDump = popular \
#     .writeStream \
#     .trigger(processingTime=slidingDuration) \
#     .outputMode("update") \
#     .format("console") \
#     .option("truncate", "false") \
#     .start()

# Example Part 6


def saveToDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mysql
    def save_to_db(iterator):
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        session.sql("USE sentence").execute()

        for row in iterator:
            # Run upsert (insert or update existing)
            sql = session.sql("INSERT INTO sentence "
                              "(id, person, n_serie, n_season, sentence, sentiment) VALUES (?, ?, ?, ?, ?, ?) ")
            sql.bind(row.id, row.person, row.n_serie, row.n_season, row.sentence, "4").execute()

        session.close()

    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db)

# Example Part 7


dbInsertStream = sentenceMessages.writeStream \
    .trigger(processingTime="30 seconds") \
    .outputMode("update") \
    .foreachBatch(saveToDatabase) \
    .start()

# Wait for termination
spark.streams.awaitAnyTermination()
