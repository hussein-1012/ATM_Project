using AqrabMakinaLeek.Domain.Common;
using AqrabMakinaLeek.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.IdGenerators;

namespace AqrabMakinaLeek.Infrastructure.Persistence;

public static class MongoClassMapper
{
    private static int _registered;

    public static void Register()
    {
        if (Interlocked.Exchange(ref _registered, 1) != 0) return;

        var conventionPack = new ConventionPack
        {
            new CamelCaseElementNameConvention(),
            new IgnoreExtraElementsConvention(true),
            new EnumRepresentationConvention(BsonType.String)
        };
        ConventionRegistry.Register("AqrabMakinaLeekConventions", conventionPack, _ => true);

        BsonClassMap.RegisterClassMap<BaseEntity>(cm =>
        {
            cm.AutoMap();
            cm.MapIdProperty(c => c.Id)
              .SetIdGenerator(StringObjectIdGenerator.Instance)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
        });

        BsonClassMap.RegisterClassMap<Atm>(cm =>
        {
            cm.AutoMap();
        });

        BsonClassMap.RegisterClassMap<User>(cm =>
        {
            cm.AutoMap();
        });

        BsonClassMap.RegisterClassMap<RefreshToken>(cm =>
        {
            cm.AutoMap();
            cm.MapProperty(c => c.UserId)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
        });

        BsonClassMap.RegisterClassMap<AtmReport>(cm =>
        {
            cm.AutoMap();
            cm.MapProperty(c => c.AtmId)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
            cm.MapProperty(c => c.UserId)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
        });

        BsonClassMap.RegisterClassMap<Favorite>(cm =>
        {
            cm.AutoMap();
            cm.MapProperty(c => c.AtmId)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
            cm.MapProperty(c => c.UserId)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
        });

        BsonClassMap.RegisterClassMap<RecentSearch>(cm =>
        {
            cm.AutoMap();
            cm.MapProperty(c => c.UserId)
              .SetSerializer(FlexibleObjectIdStringSerializer.Instance);
        });
    }
}
