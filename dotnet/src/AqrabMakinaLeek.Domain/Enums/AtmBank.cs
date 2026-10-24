using System.Text.Json.Serialization;

namespace AqrabMakinaLeek.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AtmBank
{
    NBE,
    BANQUE_MISR,
    BANQUE_DU_CAIRE,
    QNB,
    CIB,
    ALEXANDRIA_BANK,
    AGRICULTURAL_BANK,
    EGBANK,
    HOUSING_DEVELOPMENT,
    FAISAL_ISLAMIC,
    AL_BARAKA,
    AAIB,
    BANK_NXT,
    ADCB,
    CREDIT_AGRICOLE,
    POSTAL,
    OTHER
}

public static class AtmBankMetadata
{
    public static readonly IReadOnlyDictionary<AtmBank, string> BankLabels = new Dictionary<AtmBank, string>
    {
        [AtmBank.NBE] = "National Bank of Egypt NBE البنك الاهلي المصري",
        [AtmBank.BANQUE_MISR] = "Banque Misr بنك مصر",
        [AtmBank.BANQUE_DU_CAIRE] = "Banque du Caire بنك القاهرة",
        [AtmBank.QNB] = "QNB QNB Alahli بنك قطر الوطني",
        [AtmBank.CIB] = "CIB Commercial International Bank البنك التجاري الدولي",
        [AtmBank.ALEXANDRIA_BANK] = "Alexandria Bank بنك الاسكندرية",
        [AtmBank.AGRICULTURAL_BANK] = "Agricultural Bank of Egypt البنك الزراعي المصري",
        [AtmBank.EGBANK] = "EGBANK",
        [AtmBank.HOUSING_DEVELOPMENT] = "Housing and Development Bank HDB بنك التعمير والاسكان",
        [AtmBank.FAISAL_ISLAMIC] = "Faisal Islamic Bank بنك فيصل الاسلامي",
        [AtmBank.AL_BARAKA] = "Al Baraka Bank بنك البركة",
        [AtmBank.AAIB] = "Arab African International Bank AAIB البنك العربي الافريقي الدولي",
        [AtmBank.BANK_NXT] = "Bank NXT",
        [AtmBank.ADCB] = "ADCB Abu Dhabi Commercial Bank",
        [AtmBank.CREDIT_AGRICOLE] = "Credit Agricole بنك كريدي اجريكول",
        [AtmBank.POSTAL] = "Egypt Post البريد المصري",
        [AtmBank.OTHER] = ""
    };
}
