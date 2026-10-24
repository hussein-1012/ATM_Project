namespace AqrabMakinaLeek.Infrastructure.Persistence;

public class MongoOptions
{
    public const string SectionName = "Mongo";

    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string DatabaseName { get; set; } = "atm_project";
}
