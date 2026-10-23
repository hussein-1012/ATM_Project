using System.Text.RegularExpressions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Utilities;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence.Repositories;

public class AtmRepository : IAtmRepository
{
    private readonly MongoDbContext _context;

    public AtmRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<Atm?> GetByIdAsync(string id, (double Lat, double Lng)? refLocation = null, CancellationToken ct = default)
    {
        var filter = BuildIdFilter(id);
        return await _context.Atms.Find(filter).FirstOrDefaultAsync(ct);
    }

    public async Task<AtmWithDistance?> GetByIdWithDistanceAsync(string id, double refLat, double refLng, CancellationToken ct = default)
    {
        var idFilter = BuildIdFilterDoc(id);

        var pipeline = new[]
        {
            new BsonDocument("$geoNear", new BsonDocument
            {
                { "near", new BsonDocument { { "type", "Point" }, { "coordinates", new BsonArray { refLng, refLat } } } },
                { "distanceField", "distanceMeters" },
                { "spherical", true },
                { "query", idFilter }
            }),
            new BsonDocument("$limit", 1)
        };

        var rawResult = await _context.Atms.Aggregate<BsonDocument>(pipeline, cancellationToken: ct).FirstOrDefaultAsync(ct);
        if (rawResult is null)
        {
            return null;
        }

        var atm = BsonSerializer.Deserialize<Atm>(rawResult);
        var distance = rawResult.Contains("distanceMeters") ? rawResult["distanceMeters"].ToDouble() : (double?)null;
        return new AtmWithDistance(atm, distance);
    }

    public async Task<bool> ExistsAsync(string id, CancellationToken ct = default)
    {
        var filter = BuildIdFilter(id);
        var count = await _context.Atms.CountDocumentsAsync(filter, cancellationToken: ct);
        return count > 0;
    }

    public async Task<IReadOnlyList<AtmWithDistance>> GetNearbyAsync(NearbyFilterParams parameters, CancellationToken ct = default)
    {
        var pipeline = new[]
        {
            new BsonDocument("$geoNear", new BsonDocument
            {
                { "near", new BsonDocument { { "type", "Point" }, { "coordinates", new BsonArray { parameters.Lng, parameters.Lat } } } },
                { "distanceField", "distanceMeters" },
                { "maxDistance", parameters.RadiusMeters },
                { "spherical", true }
            }),
            new BsonDocument("$limit", parameters.Limit)
        };

        var docs = await _context.Atms.Aggregate<BsonDocument>(pipeline, cancellationToken: ct).ToListAsync(ct);
        var results = new List<AtmWithDistance>(docs.Count);
        foreach (var doc in docs)
        {
            var atm = BsonSerializer.Deserialize<Atm>(doc);
            var distance = doc.Contains("distanceMeters") ? doc["distanceMeters"].ToDouble() : (double?)null;
            results.Add(new AtmWithDistance(atm, distance));
        }

        return results;
    }

    public async Task<IReadOnlyList<AtmWithDistance>> SearchRowsAsync(AtmSearchParams parameters, CancellationToken ct = default)
    {
        var (filters, limit, offset) = parameters;

        if (filters.Lat.HasValue && filters.Lng.HasValue)
        {
            var matchQuery = BuildMatchQueryBson(filters);
            var geoNearDoc = new BsonDocument
            {
                { "near", new BsonDocument { { "type", "Point" }, { "coordinates", new BsonArray { filters.Lng.Value, filters.Lat.Value } } } },
                { "distanceField", "distanceMeters" },
                { "spherical", true }
            };

            if (matchQuery.ElementCount > 0)
            {
                geoNearDoc.Add("query", matchQuery);
            }

            if (filters.MaxDistanceMeters.HasValue && filters.MaxDistanceMeters.Value > 0)
            {
                geoNearDoc.Add("maxDistance", filters.MaxDistanceMeters.Value);
            }

            var pipeline = new List<BsonDocument>
            {
                new("$geoNear", geoNearDoc)
            };

            if (offset > 0)
            {
                pipeline.Add(new BsonDocument("$skip", offset));
            }

            pipeline.Add(new BsonDocument("$limit", limit));

            var docs = await _context.Atms.Aggregate<BsonDocument>(pipeline, cancellationToken: ct).ToListAsync(ct);
            var results = new List<AtmWithDistance>(docs.Count);
            foreach (var doc in docs)
            {
                var atm = BsonSerializer.Deserialize<Atm>(doc);
                var distance = doc.Contains("distanceMeters") ? doc["distanceMeters"].ToDouble() : (double?)null;
                results.Add(new AtmWithDistance(atm, distance));
            }

            return results;
        }
        else
        {
            var filter = BuildSearchFilter(filters);
            var docs = await _context.Atms
                .Find(filter)
                .SortBy(a => a.Name)
                .Skip(offset)
                .Limit(limit)
                .ToListAsync(ct);

            return docs.Select(a => new AtmWithDistance(a, null)).ToList();
        }
    }

    public async Task<long> SearchCountAsync(AtmSearchFilters filters, CancellationToken ct = default)
    {
        var filter = BuildSearchFilter(filters);
        return await _context.Atms.CountDocumentsAsync(filter, cancellationToken: ct);
    }

    public async Task<IReadOnlyList<AtmWithDistance>> FindManyByIdsAsync(
        IEnumerable<string> ids,
        (double Lat, double Lng)? refLocation = null,
        CancellationToken ct = default)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return [];

        if (refLocation.HasValue)
        {
            var idBsonArray = new BsonArray();
            foreach (var id in idList)
            {
                if (ObjectId.TryParse(id, out var oid))
                    idBsonArray.Add(oid);
                else
                    idBsonArray.Add(id);
            }

            var pipeline = new[]
            {
                new BsonDocument("$geoNear", new BsonDocument
                {
                    { "near", new BsonDocument { { "type", "Point" }, { "coordinates", new BsonArray { refLocation.Value.Lng, refLocation.Value.Lat } } } },
                    { "distanceField", "distanceMeters" },
                    { "spherical", true },
                    { "query", new BsonDocument("_id", new BsonDocument("$in", idBsonArray)) }
                })
            };

            var docs = await _context.Atms.Aggregate<BsonDocument>(pipeline, cancellationToken: ct).ToListAsync(ct);
            var results = new List<AtmWithDistance>(docs.Count);
            foreach (var doc in docs)
            {
                var atm = BsonSerializer.Deserialize<Atm>(doc);
                var distance = doc.Contains("distanceMeters") ? doc["distanceMeters"].ToDouble() : (double?)null;
                results.Add(new AtmWithDistance(atm, distance));
            }

            return results;
        }

        var filterBuilder = Builders<Atm>.Filter;
        var filterList = new List<FilterDefinition<Atm>>();
        foreach (var id in idList)
        {
            filterList.Add(BuildIdFilter(id));
        }

        var combinedFilter = filterBuilder.Or(filterList);
        var directDocs = await _context.Atms.Find(combinedFilter).ToListAsync(ct);
        return directDocs.Select(a => new AtmWithDistance(a, null)).ToList();
    }

    public async Task<Atm?> GetBySourceAsync(string source, string sourceId, CancellationToken ct = default)
    {
        return await _context.Atms.Find(a => a.Source == source && a.SourceId == sourceId).FirstOrDefaultAsync(ct);
    }

    public async Task InsertAsync(Atm atm, CancellationToken ct = default)
    {
        atm.CreatedAt = DateTime.UtcNow;
        atm.UpdatedAt = DateTime.UtcNow;
        await _context.Atms.InsertOneAsync(atm, cancellationToken: ct);
    }

    public async Task UpdateAsync(Atm atm, CancellationToken ct = default)
    {
        atm.UpdatedAt = DateTime.UtcNow;
        var filter = BuildIdFilter(atm.Id);
        await _context.Atms.ReplaceOneAsync(filter, atm, cancellationToken: ct);
    }

    public async Task UpsertManyAsync(IEnumerable<Atm> atms, CancellationToken ct = default)
    {
        var atmList = atms.ToList();
        if (atmList.Count == 0) return;

        var operations = new List<WriteModel<Atm>>(atmList.Count);
        var now = DateTime.UtcNow;

        foreach (var atm in atmList)
        {
            atm.UpdatedAt = now;
            var filter = Builders<Atm>.Filter.And(
                Builders<Atm>.Filter.Eq(a => a.Source, atm.Source),
                Builders<Atm>.Filter.Eq(a => a.SourceId, atm.SourceId)
            );

            operations.Add(new ReplaceOneModel<Atm>(filter, atm) { IsUpsert = true });
        }

        await _context.Atms.BulkWriteAsync(operations, cancellationToken: ct);
    }

    public async Task<long> CountAsync(CancellationToken ct = default)
    {
        return await _context.Atms.CountDocumentsAsync(Builders<Atm>.Filter.Empty, cancellationToken: ct);
    }

    private static FilterDefinition<Atm> BuildIdFilter(string id)
    {
        if (ObjectId.TryParse(id, out var oid))
        {
            return Builders<Atm>.Filter.Eq("_id", oid);
        }
        return Builders<Atm>.Filter.Eq("_id", id);
    }

    private static BsonDocument BuildIdFilterDoc(string id)
    {
        if (ObjectId.TryParse(id, out var oid))
        {
            return new BsonDocument("_id", oid);
        }
        return new BsonDocument("_id", id);
    }

    private static FilterDefinition<Atm> BuildSearchFilter(AtmSearchFilters filters)
    {
        var builder = Builders<Atm>.Filter;
        var list = new List<FilterDefinition<Atm>>();

        if (!string.IsNullOrWhiteSpace(filters.Query))
        {
            var normalized = ArabicNormalizeUtil.NormalizeArabic(filters.Query);
            var escaped = Regex.Escape(normalized);
            list.Add(builder.Regex(a => a.SearchText, new BsonRegularExpression(escaped, "i")));
        }

        if (filters.Bank.HasValue)
        {
            list.Add(builder.Eq(a => a.Bank, filters.Bank.Value));
        }

        if (filters.WheelchairOnly == true)
        {
            list.Add(builder.Eq(a => a.WheelchairAccessible, true));
        }

        return list.Count > 0 ? builder.And(list) : builder.Empty;
    }

    private static BsonDocument BuildMatchQueryBson(AtmSearchFilters filters)
    {
        var doc = new BsonDocument();

        if (!string.IsNullOrWhiteSpace(filters.Query))
        {
            var normalized = ArabicNormalizeUtil.NormalizeArabic(filters.Query);
            var escaped = Regex.Escape(normalized);
            doc.Add("searchText", new BsonRegularExpression(escaped, "i"));
        }

        if (filters.Bank.HasValue)
        {
            doc.Add("bank", filters.Bank.Value.ToString());
        }

        if (filters.WheelchairOnly == true)
        {
            doc.Add("wheelchairAccessible", true);
        }

        return doc;
    }
}
