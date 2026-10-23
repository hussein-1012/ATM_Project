using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace AqrabMakinaLeek.Infrastructure.Persistence;

/// <summary>
/// Serializes 24-character hex strings as MongoDB BsonObjectId (for full Mongoose interoperability)
/// while gracefully falling back to BsonString for non-ObjectId strings.
/// Deserializes both BsonObjectId and BsonString seamlessly to C# string.
/// </summary>
public class FlexibleObjectIdStringSerializer : SerializerBase<string>
{
    public static readonly FlexibleObjectIdStringSerializer Instance = new();

    public override string Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var type = context.Reader.GetCurrentBsonType();
        return type switch
        {
            BsonType.ObjectId => context.Reader.ReadObjectId().ToString(),
            BsonType.String => context.Reader.ReadString(),
            BsonType.Null => ReadNull(context),
            _ => throw new BsonSerializationException($"Cannot deserialize string from BSON type {type}")
        };
    }

    private static string ReadNull(BsonDeserializationContext context)
    {
        context.Reader.ReadNull();
        return string.Empty;
    }

    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            context.Writer.WriteNull();
            return;
        }

        if (ObjectId.TryParse(value, out var oid))
        {
            context.Writer.WriteObjectId(oid);
        }
        else
        {
            context.Writer.WriteString(value);
        }
    }
}
